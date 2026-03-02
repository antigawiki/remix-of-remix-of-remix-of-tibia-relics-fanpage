
## Correção de 2 Bugs: Map Extractor + Cam Player

### Bug 1: Tiles duplicados/deslocados no Map Extractor

**Causa raiz:** Quando o floor muda, `parser.process()` ja executou o novo MAP_DESC que sobrescreveu `gs.tiles` com coordenadas deslocadas (perspective offsets). O snapshot feito DEPOIS captura tiles com posicoes erradas.

**Fix em `src/lib/tibiaRelic/mapExtractor.ts`** (sync e async):
- Remover o snapshot contaminado no momento da troca de floor (linhas 100-107 e 193-200)
- Quando detectar floor change: apenas limpar `gs.tiles` e resetar estabilidade
- O snapshot estavel do batch anterior ja capturou o floor antigo corretamente

```text
ANTES (bugado):
  if (lastCamZ >= 0 && gs.camZ !== lastCamZ) {
    gs.camZ = lastCamZ;          // restaura Z antigo
    snapshotTiles(gs, dat, ...); // captura tiles JA CONTAMINADOS pelo novo MAP_DESC
    gs.camZ = newZ;
    gs.tiles.clear();
  }

DEPOIS (corrigido):
  if (lastCamZ >= 0 && gs.camZ !== lastCamZ) {
    gs.tiles.clear();            // limpa tiles contaminados, sem snapshot
    anyFloorChange = true;
  }
```

### Bug 2: Race condition no seek + tela preta no Cam Player

**Fix em `src/components/TibiarcPlayer.tsx`:**

1. **seekingRef** - Nova ref booleana para proteger o polling durante seek
   - `handleSeek` seta `seekingRef = true` antes de pausar, e `false` depois de dar play
   - O intervalo de polling ignora ticks enquanto `seekingRef.current === true`

2. **preserveDrawingBuffer** - Passar `webglContextAttributes: { preserveDrawingBuffer: true }` na inicializacao do modulo WASM para evitar buffer limpo entre frames

3. **visibilitychange handler** - Ao voltar para a aba, se o player estava tocando, faz pause+play rapido para re-acordar o loop de renderizacao do WASM

### Apos aplicar

1. Limpar banco de dados (Limpar DB)
2. Re-extrair todos os arquivos .cam
3. Regenerar mapa (Gerar Mapa)
