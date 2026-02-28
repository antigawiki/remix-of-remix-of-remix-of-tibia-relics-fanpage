

## Plano: Remover Itens/Tiles e Manter Apenas Monstros Vivos

### Problema
O mapa esta poluido com itens extraidos (chao, objetos, cadaveres) que se sobrepoe ao mapa base do opentibia. Como o mapa base ja mostra o terreno corretamente, os tiles extraidos das .cam sao redundantes e so atrapalham. O objetivo e manter **apenas as criaturas vivas** como overlay no mapa.

### Solucao

**1. CamMapPage.tsx - Parar de carregar e renderizar tiles**
- Remover o carregamento de `cam_map_chunks` do `preloadFloor`
- Manter apenas o carregamento de `cam_map_creatures`
- No tile layer do Leaflet, desenhar apenas o mapa base externo + criaturas (sem tiles extraidos)
- Remover contagem de tiles da UI (manter apenas contagem de criaturas)

**2. MapTileRenderer - Simplificar renderChunk**
- O metodo `renderChunk` passa a ser usado apenas para desenhar criaturas
- Tiles (items) podem ser ignorados - o parametro continua existindo por compatibilidade mas nao precisa ser preenchido

**3. Fluxo resultante**
```text
Antes:  Base map + tiles extraidos + criaturas = poluido
Depois: Base map + criaturas = limpo
```

### Arquivos Modificados
- `src/pages/CamMapPage.tsx` - remover preload de chunks, simplificar rendering
- Nenhuma mudanca no banco ou no extrator (os dados ficam salvos para uso futuro se necessario)

