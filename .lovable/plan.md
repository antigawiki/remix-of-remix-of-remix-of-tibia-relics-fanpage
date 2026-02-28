

## Plano: Reativar Terreno Extraido das .cam + Criaturas (sem Players)

### Problema
O mapa externo nao cobre todas as areas. Ao desativar os tiles extraidos das .cam, perdeu-se o terreno em areas que o mapa externo nao possui. O objetivo e mostrar **terreno extraido + criaturas** como camada sobre o mapa externo (que serve de fallback onde existir).

### Solucao

**Arquivo: `src/pages/CamMapPage.tsx`**

Reativar o carregamento de `cam_map_chunks` no `preloadFloor`, distribuindo os tiles para o grid de 8x8 do renderer:

1. Voltar a carregar `cam_map_chunks` paginado por floor (z), em paralelo com `cam_map_creatures`
2. Para cada chunk (32x32), extrair as posicoes relativas do JSONB `tiles_data` e converter para coordenadas absolutas, agrupando por sub-chunks de 8x8 (chave do renderer)
3. Popular o `floorDataRef` com os `TileData[]` para cada sub-chunk
4. Restaurar `getChunkTiles` para buscar dados do `floorDataRef` em vez de retornar array vazio
5. Atualizar contadores na UI para mostrar tiles + criaturas

**Fluxo de rendering (camadas):**
```text
1. Mapa base externo (fallback onde existir)
2. Tiles extraidos das .cam (terreno completo)
3. Criaturas vivas (sem players, ja filtradas na extracao)
```

### Detalhes Tecnicos

Na funcao `preloadFloor`, adicionar logica paralela:

```text
// Carregar chunks e criaturas em paralelo
const [chunkResult, creatureResult] = await Promise.all([
  loadChunks(z, onProgress),
  loadCreatures(z, onProgress),
]);
```

Para converter chunks 32x32 em sub-chunks 8x8:
```text
Para cada chunk (cx, cy, z) com tiles_data:
  Para cada tile "relX,relY" -> [itemIds]:
    absX = cx * 32 + relX
    absY = cy * 32 + relY
    subChunkX = floor(absX / 8)
    subChunkY = floor(absY / 8)
    Adicionar TileData { x: absX, y: absY, z, items: itemIds } ao sub-chunk
```

### Arquivos Modificados
- `src/pages/CamMapPage.tsx` - reativar preload de chunks + distribuir para renderer

### O que NAO muda
- `mapExtractor.ts` - ja filtra players e criaturas mortas corretamente
- `mapTileRenderer.ts` - ja renderiza tiles + criaturas corretamente
- `CamBatchExtractPage.tsx` - ja salva chunks e criaturas no banco

