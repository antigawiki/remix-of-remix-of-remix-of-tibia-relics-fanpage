

## Plano: Otimizar Carregamento de Tiles e Corrigir Criaturas

### Problema 1: Tiles individuais muito lentos

**Situacao atual**: Cada tile (1x1, 32px) e uma linha separada no banco. Um andar com 40.000 tiles = 40.000 linhas para carregar via queries paginadas. Isso e extremamente lento.

**Solucao**: Agregar tiles em chunks de 32x32 tiles no banco. Cada chunk vira UMA unica linha contendo todos os tiles daquela area. Isso reduz o numero de linhas por ~1024x (40.000 tiles -> ~40 chunks).

- Criar nova tabela `cam_map_chunks` com colunas: `chunk_x`, `chunk_y`, `z`, `tiles_data` (jsonb com mapa de posicoes relativas para items)
- Adaptar o batch extract para salvar nessa nova tabela ao inves de `cam_map_tiles`
- Adaptar o CamMapPage para carregar chunks em vez de tiles individuais
- Criar funcao SQL `merge_cam_chunk` para unir dados de diferentes .cam no mesmo chunk

**Estrutura do chunk no banco:**
```text
chunk_x=1010, chunk_y=1007, z=7
tiles_data = {
  "3,5": [100, 201, 305],   // tile na posicao relativa (3,5) dentro do chunk
  "3,6": [100, 202],
  ...
}
```

### Problema 2: Criaturas mortas aparecendo / vivas nao aparecendo

**Causa raiz na extracao**: O filtro `c.health <= 0` funciona corretamente para excluir mortos durante a extracao. Porem, o problema e que criaturas sao capturadas em TODAS as posicoes por onde passaram durante a cam (cada frame atualiza posicao). Isso acumula centenas de entradas para o mesmo monstro.

**Solucao**: Deduplicar criaturas por nome + area aproximada. Em vez de gravar a posicao exata de cada frame, arredondar coordenadas para um grid de 5x5 tiles. Assim, um "Rat" que andou por 10 tiles diferentes gera apenas 1-2 entradas em vez de 10.

- Alterar a chave do `creatureMap` no extractor para usar coordenadas arredondadas: `round(x/5)*5, round(y/5)*5, z, name`
- Na tabela `cam_map_creatures`, manter a mesma estrutura mas com coordenadas arredondadas
- Isso resolve tanto o acumulo quanto garante que somente criaturas vivas (filtradas pelo health > 0) sejam gravadas

### Problema 3: Coordenadas do chunk no Leaflet

O CamMapPage atualmente usa CHUNK_TILES=8 para mapear coordenadas. Com chunks de 32x32 tiles no banco, o mapeamento precisa ser atualizado para que cada tile do Leaflet (256px) corresponda a exatamente 1 chunk do banco (32 tiles * 8px por tile em zoom maximo, ou 32*32px = 1024px em resolucao nativa).

Na verdade, manter o renderer existente de 8x8 tiles para 256px e mais simples. A mudanca e apenas na camada de dados: carregar 1 chunk de 32x32 do banco e distribuir os tiles para os sub-chunks de 8x8 do renderer.

---

### Detalhes Tecnicos

**1. Migracao SQL:**
- Criar tabela `cam_map_chunks` (chunk_x int, chunk_y int, z int, tiles_data jsonb, PRIMARY KEY (chunk_x, chunk_y, z))
- Criar funcao `merge_cam_chunk(px, py, pz, new_data jsonb)` que faz merge dos tiles_data

**2. Arquivos modificados:**
- `src/lib/tibiaRelic/mapExtractor.ts` - deduplicar criaturas por grid 5x5
- `src/pages/CamBatchExtractPage.tsx` - salvar como chunks de 32x32 em vez de tiles individuais
- `src/pages/CamMapPage.tsx` - carregar chunks e distribuir para o renderer

**3. Fluxo de carregamento otimizado:**
```text
Antes: SELECT * FROM cam_map_tiles WHERE z=7 (40.000+ rows, paginado)
Depois: SELECT * FROM cam_map_chunks WHERE z=7 (~40-200 rows, rapido)
```

