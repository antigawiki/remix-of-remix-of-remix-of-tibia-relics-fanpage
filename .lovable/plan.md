

## Diagnóstico: O problema é mais profundo que offsets e floor ranges

Após análise extensiva do código, identifiquei que todas as "correções" anteriores (offset=0, camX/Y condicional) **divergem da implementação de referência C++** e podem estar piorando as coisas. O problema real é que o parser silenciosamente consome bytes inválidos sem reportar erro, mascarando byte drift.

### Problemas encontrados

**1. `readTileItems` consome u16 desconhecidos silenciosamente**
Quando o parse fica desalinhado por 1 byte (por qualquer razão), valores u16 inválidos (fora do range 100-9999, não são creature markers, não são skip markers) são consumidos sem erro. Isso permite que a corrupção se propague silenciosamente por centenas de bytes sem nunca lançar um erro.

**2. Nossas "correções" divergem do C++ de referência**
- O C++ usa `offset = camZ - nz` SEMPRE (incluindo superfície) — nós mudamos para `offset = 0`
- O C++ faz `camX++/camY++` INCONDICIONALMENTE no floorUp — nós tornamos condicional
- Essas divergências podem causar inconsistências entre como os tiles são armazenados vs como o renderer os procura

**3. Sem detecção de formato por gravação**
Diferentes .cam files podem ter variações de protocolo. Sem detecção automática, usamos um formato fixo que funciona para alguns e quebra para outros.

### Plano de correção

**Passo 1: Reverter offset e camX/Y para o comportamento original (match C++)**
- `readMultiFloorArea`: voltar para `offset = camZ - nz` (sem condição)
- `floorUp`: `camX++; camY++` incondicional
- `floorDown`: `camX--; camY--` incondicional

**Passo 2: Adicionar validação em `readTileItems` para detectar byte drift**
- Quando um u16 não é skip marker, creature marker, nem item válido (100-9999): lançar erro em vez de consumir silenciosamente
- Isso vai EXPOR o verdadeiro ponto de falha em vez de mascará-lo

**Passo 3: Adicionar detecção de formato per-scroll**
- Antes de ler o scroll, salvar posição do buffer
- Após ler, verificar se o próximo byte é um opcode válido (0x0a-0xf1)
- Se não for, reverter e tentar formato alternativo (standard 1-row/col vs full viewport)
- Isso lida com gravações que usam formatos diferentes

**Passo 4: Ajustar `mapExtractor.ts` para reverter o offset ao armazenar tiles**
- Para o mapa, queremos coordenadas reais: `actual_x = stored_x - offset`
- Adicionar compensação no `snapshotTiles` para que tiles do mapa tenham posições absolutas

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `packetParser.ts` | Reverter offset e camX/Y; validação em readTileItems; scroll auto-detect |
| `mapExtractor.ts` | Compensar offset na captura de tiles para coordenadas absolutas |

### Por que isso vai funcionar
O problema central é que o parser mascara erros. Ao tornar erros **visíveis** (passo 2) e **adaptar o formato** (passo 3), o parser vai ou processar corretamente ou falhar rápido e recuperar, em vez de corromper silenciosamente o estado do jogo.

