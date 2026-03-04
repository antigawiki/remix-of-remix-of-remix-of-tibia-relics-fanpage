

## Diagnóstico: Por que o Protocol Lab diz "0 erros"

### Causa Raiz

O Protocol Lab depende de **exceções** para detectar erros. Mas o `PacketParser` tem **3 camadas de try/catch** que engolem erros silenciosamente:

```text
process()           → try/catch (re-throws)
  └─ processOpcodes()   → try/catch { break; }     ← ENGOLE o erro
  └─ processTcpDemux()  → try/catch { break; }     ← ENGOLE o erro  
  └─ processDirectOpcodes() → try/catch { break; }  ← ENGOLE o erro
```

Resultado: os erros internos nunca chegam ao `process()`, nunca chegam ao Lab. O Lab vê 0 exceções → "0 erros".

Enquanto isso, o Analyzer detecta problemas por **comparação de estado** (posição antes/depois), não por exceções. Por isso ele encontra anomalias que o Lab não vê.

### Padrões nas Anomalias (do JSON enviado)

Analisando os 26.216 frames da cam:

1. **Player desync após floorDown (0xBF)**: Frames 6571, 6625, 20233, 20243 — o player fica em posição errada (ex: cam=32879,32643 mas player=32883,32637). Isso indica que o `moveCr` perde a referência do player no tile após um floor change.

2. **Player desync prolongado na superfície (z=7)**: Frames 23729-24316 — dezenas de frames onde o player está 3-7 tiles distante da câmera (cam=32940,32645 mas player=32936,32643). Esses são `moveCr` (opcode 109=0x6D) onde o player não está no tile esperado, então o fallback `player_lookup` dá posição errada.

3. **Teleports legítimos via mapDesc (0x64)**: Frames 1339, 2321, 2497, 20905 — estes são esperados (mudança de local).

### Plano de Correção Completo

#### 1. Redesenhar o Protocol Lab para detectar por estado (não por exceção)

O Lab deve funcionar como o Analyzer: comparar snapshots antes/depois de cada frame. Um frame é "problemático" se:
- Player diverge da câmera por mais de 2 tiles
- Player muda de floor sem opcode de floor change
- Posição do player salta mais de 2 tiles em um único `moveCr`

Para cada frame problemático, testar as 5 estratégias e verificar qual produz o menor delta player-câmera.

#### 2. Adicionar modo "strict" ao PacketParser

Novo flag `strictMode` que, em vez de engolir erros nos try/catch internos, os re-lança. Isso permite ao Lab capturar erros de parsing reais que hoje são silenciados. Ambos os modos coexistem: o player usa o modo leniente (para não crashar), o Lab usa o modo estrito (para diagnosticar).

#### 3. Corrigir o moveCr player fallback

O problema real: após `readMultiFloorArea` (scroll/floorUp/floorDown), a referência do player no tile é perdida. O fallback `player_lookup` (proximity search) encontra o player mas com posição desatualizada, causando jumps de 3-7 tiles. A correção é:
- Após cada `readMultiFloorArea`, chamar `reinsertCreaturesOnTiles` (já existe mas pode não cobrir todos os casos)
- No `moveCr`, quando o player não é encontrado no tile esperado, usar a posição registrada no objeto `Creature` em vez de a posição do tile

#### 4. Registrar bytes restantes no buffer após cada frame

Adicionar ao Lab e ao Analyzer: se após processar um frame sobram bytes que deveriam ter sido consumidos (leftover > 0), isso indica que algum opcode consumiu bytes demais ou de menos. Registrar isso como métrica de "drift" de bytes.

### Mudanças Técnicas

**`camProtocolLab.ts`** — Reescrever completamente:
- Fase 1: Processar todos frames, salvar snapshot antes de cada um, detectar anomalias por estado (como o Analyzer)
- Fase 2: Para cada frame anômalo, testar as 5 estratégias, comparar qual produz menor desync
- Adicionar detecção de bytes leftover por frame
- Usar `strictMode` para capturar erros que hoje são engolidos

**`packetParser.ts`** — Adicionar `strictMode`:
- Novo flag no constructor options
- Quando ativo, `processOpcodes`/`processTcpDemux`/`processDirectOpcodes` re-lançam exceções em vez de `break`
- Registrar `bytesLeftAfterProcess` — quantos bytes sobraram no buffer após `process()`

**`ProtocolLabTab.tsx`** — Atualizar UI:
- Mostrar anomalias por estado (player-cam delta) em vez de apenas exceções
- Coluna de "bytes restantes" para detectar drift
- Comparação visual das 5 estratégias mostrando delta de posição para cada uma
- Filtros por tipo de anomalia (desync, position jump, floor jump)

