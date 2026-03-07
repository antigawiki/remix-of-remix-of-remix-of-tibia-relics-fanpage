

## Diagnóstico: Por que a extração coloca tiles em andares errados

Comparando o projeto de referência (Cam Mapper) com este projeto, identifiquei a causa raiz:

### O Bug
O `mapExtractor.ts` atual processa frames em lotes de 500. Durante um lote, o `camZ` do player pode mudar (ex: de 7 para 6). Mas o `snapshotTiles()` usa o `camZ` **atual** (do final do lote) para reverter o perspective offset de **todos** os tiles, incluindo os que foram armazenados com um `camZ` diferente. Isso coloca tiles no andar errado.

```text
Frame 1-200: camZ=7, tiles armazenados com offset = 7 - nz
Frame 201-500: camZ=6, tiles armazenados com offset = 6 - nz
snapshotTiles(): reverte TODOS com camZ=6 ← ERRADO para frames 1-200
```

### O projeto de referência não tem esse bug
O Cam Mapper usa um ProtocolParser TypeScript puro que:
1. Processa cada pacote individualmente (sem batching)
2. Armazena tiles com coordenadas já com offset (sem necessidade de reverter depois)
3. Usa `return` em opcodes desconhecidos (sem exceções, sem perda de dados)
4. Não tem spawn tracking (mas o protocolo está correto)

### Plano: Portar o motor de extração do projeto de referência

Substituir o `mapExtractor.ts` por um extrator baseado no ProtocolParser do projeto de referência, adaptado para TibiaRelic 7.72, mantendo o motor WASM intacto para o Cam Player visual.

#### Arquivos novos (portados + adaptados do Cam Mapper)

**`src/lib/tibiaRelic/extractionParser.ts`** (~500 linhas)
- Portar o `ProtocolParser` + `InputMessage` do projeto de referência
- Adaptar para TibiaRelic 7.72: adicionar handlers para opcodes custom (0xA4 SpellCooldown 2B, 0xA5 GroupCooldown 5B, 0xA7 PlayerTactics 3B, 0xA8 CreatureSquare 5B, 0xB5 CancelWalk 3B com u16 delay, 0xB6 WalkCancel como alias)
- Usar `u16` para looktype (TibiaRelic usa u16, não u8)
- No `parseTileDescription`: armazenar tiles com coordenadas **absolutas** (subtraindo o offset no momento da escrita, quando sabemos o z correto)
- Adicionar tracking de criaturas para spawn data: guardar nome, outfit, health, posição absoluta

**`src/lib/tibiaRelic/extractionStore.ts`** (~150 linhas)
- MapStore simplificado que armazena tiles com coordenadas absolutas
- Tracking de criaturas vivas por chunk 32x32 (lógica de visitas do spawn system atual)
- Método `getResults()` retorna `{ tiles: Map<string, number[]>, spawns: SpawnData[] }`

#### Arquivos modificados

**`src/lib/tibiaRelic/extractionWorker.ts`**
- Trocar `extractMapTilesSync` pelo novo `ExtractionParser` + `ExtractionStore`
- Processar cada frame/pacote individualmente (sem batching de 500)
- Manter a interface de mensagens (progress/result/error) inalterada

**`src/lib/tibiaRelic/mapExtractor.ts`**
- Manter como wrapper para compatibilidade: `extractMapTilesSync` e `extractMapTiles` delegam ao novo `ExtractionParser`
- A interface de retorno (`MapExtractionResult`) permanece idêntica

#### Inalterados
- Motor WASM (`tibiarc_player.wasm/js`) — intocado
- `CamPlayerPage`, `TibiarcPlayer` — continuam usando WASM
- `CamBatchExtractPage` — continua funcionando via Worker (mesma interface)
- `camParser.ts` — reutilizado para parsear o .cam container

#### Melhorias no spawn tracking
- Filtrar criaturas em tiles não-walkable (usando `blockObject` do DAT) para evitar monstros "dentro de paredes"
- Validar que a criatura está dentro do viewport real (±9x, ±7y do player) ao invés do raio genérico de 20
- Usar sprite dimensions (width/height) do DAT para posicionar corretamente criaturas multi-tile e evitar sprites "cortados pela metade"

