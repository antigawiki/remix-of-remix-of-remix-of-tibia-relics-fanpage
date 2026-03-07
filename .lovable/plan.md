

## Plano: Separar camParser e datLoader entre Cam Player e Cam Map

### Situacao atual

Ambos os sistemas (Player e Map) importam os mesmos `camParser.ts` e `datLoader.ts`. Alterações em um afetam o outro.

### Arquivos novos

| Arquivo novo | Conteudo |
|---|---|
| `src/lib/tibiaRelic/playerCamParser.ts` | Copia de `camParser.ts` |
| `src/lib/tibiaRelic/playerDatLoader.ts` | Copia de `datLoader.ts` |

### Imports a atualizar

**Cam Player** (mudar para `playerCamParser` e `playerDatLoader`):
- `src/lib/tibiaRelic/packetParser.ts` — datLoader
- `src/lib/tibiaRelic/renderer.ts` — datLoader
- `src/lib/tibiaRelic/gameState.ts` — datLoader (se importar)
- `src/lib/tibiaRelic/camAnalyzer.ts` — camParser + datLoader
- `src/lib/tibiaRelic/camProtocolLab.ts` — camParser + datLoader
- `src/components/CamFrameDebugger.tsx` — camParser + datLoader
- `src/components/PacketDissector.tsx` — camParser + datLoader
- `src/pages/CamAnalyzerPage.tsx` — datLoader
- `src/components/cam-analyzer/ProtocolLabTab.tsx` — datLoader

**Cam Map** (sem alteracao, continua usando os originais):
- `extractionParser.ts`, `extractionWorker.ts`, `extractionStore.ts`, `mapExtractor.ts`, `mapTileRenderer.ts`, `CamMapPage.tsx`

### Resultado

Cada sistema tem seus proprios arquivos de parsing. Correcoes no DatLoader do Cam Map (flag 0x00 = 2 bytes) nao afetam o Player, e vice-versa.

