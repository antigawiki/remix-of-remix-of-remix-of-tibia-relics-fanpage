

## Diagnóstico: Não é luz — é o floor range dos scrolls

Sua hipótese sobre luminância é criativa, mas **não é isso**. No protocolo Tibia 7.72, a luz não é enviada como dados extras por tile na rede. A luz funciona assim:

- **Luz ambiente (0x82)**: 2 bytes (intensidade + cor) — já lido pelo parser
- **Luz de criatura (0x8D)**: 6 bytes (creatureId + intensidade + cor) — já lido
- **Luz de item**: vem do arquivo `.dat` (flag 0x15, 4 bytes), não do protocolo de rede

O parser lê todos esses corretamente. Os bytes sobrando não são dados de luz.

### A causa real (confirmada pelo JSON que você enviou)

O JSON mostra claramente:

```text
150 anomalias — 100% são BYTES_LEFTOVER
147 de 150 (98%) resolvidas pela estratégia A (7→0)
0 DESYNCs, 0 PARSE_ERRORs
```

O problema é **exatamente o mesmo** que diagnosticamos antes: os **scrolls** (0x65-0x68) na superfície enviam dados para todos os floors visíveis (7→0), mas o parser usa `getFloorRange` que retorna apenas ±2 (3 floors). Os floors extras ficam não-lidos e são reportados como "leftover".

### Por que a última correção piorou

Na primeira tentativa, mudamos `getFloorRange` para 7→0 **E** mudamos `floorUp` para ler floors 5→0. Mas `floorUp`/`floorDown` só enviam dados do **único** novo floor visível, não todos os floors. Ler 6 floors quando só 1 foi enviado causou byte drift → DESYNCs.

Na correção seguinte, revertemos `getFloorRange` para ±2 (conservador demais) e criamos `getMapDescFloorRange` (7→0 só para mapDesc). Isso resolveu o mapDesc mas os scrolls continuam com ±2 → voltamos aos mesmos leftover.

### Correção cirúrgica

A solução é simples — dois pontos:

1. **`getFloorRange`**: mudar para 7→0 na superfície (afeta scrolls)
2. **`floorUp`/`floorDown`**: manter como está (lê apenas 1 floor novo)
3. **Remover `getMapDescFloorRange`**: não precisa mais, pois `getFloorRange` já retorna 7→0

Isso funciona porque:
- `scroll()` usa `getFloorRange` → agora lê 7→0 → consome todos os bytes ✓
- `mapDesc()` pode usar `getFloorRange` também → mesmo resultado ✓
- `floorUp`/`floorDown` chamam `readFloorArea` diretamente, **não usam** `getFloorRange` → não são afetados ✓
- `readMultiFloorArea` já tem um guard `if (r.left() < 2) break` que para automaticamente quando não há mais dados para floors distantes → seguro ✓

O `readMultiFloorArea` já lida com floors vazios (skip markers de 2 bytes) e com exhaustion (para quando o buffer acaba). Não há risco de ler dados demais.

### Mudanças

**`packetParser.ts`:**
- `getFloorRange`: surface → `{ startz: 7, endz: 0, zstep: -1 }`
- Remover `getMapDescFloorRange` (redundante)
- `mapDesc`: usar `getFloorRange` em vez de `getMapDescFloorRange`
- `floorUp`/`floorDown`: sem mudanças (já estão corretos)

