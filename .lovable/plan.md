

## Plano: Armazenamento individual de tiles + compactacao automatica

### Problema atual

O sistema de chunks 32x32 acumula itens duplicados porque o merge JSONB faz UNION DISTINCT nos arrays de item IDs por posicao relativa. Quando multiplas `.cam` passam pela mesma area, os mesmos itens sao re-inseridos, causando empilhamento visual. Alem disso, o chunk 32x32 e grande demais para o renderer que trabalha em 8x8, exigindo redistribuicao na hora do carregamento.

### Solucao proposta: 2 fases

**Fase 1 - Extracao individual (tile por tile)**

Alterar a extracao para salvar cada tile individualmente na tabela `cam_map_tiles` (que ja existe com colunas x, y, z, items). A funcao `merge_cam_tile` ja faz merge por tile individual. Ao inves de agrupar em chunks 32x32 no upload, enviar diretamente tile a tile usando `merge_cam_tile`.

Vantagem: cada posicao x,y,z tera exatamente os itens corretos, sem duplicacao.

**Fase 2 - Compactacao automatica em chunks 8x8**

Adicionar um botao "Compactar" na pagina de extracoes que:
1. Le todos os tiles individuais da `cam_map_tiles` por floor
2. Agrupa em chunks 8x8 (mesmo tamanho do renderer)
3. Salva na `cam_map_chunks` com chunk_size = 8

O viewer ja carrega de `cam_map_chunks`, entao nao precisa mudar. Apenas o tamanho do chunk muda de 32 para 8 (alinhado com o renderer).

A compactacao tambem pode rodar automaticamente ao final do processamento de cada `.cam`.

---

### Mudancas tecnicas

#### 1. `mapExtractor.ts` - Upload individual de tiles

- Remover o agrupamento em chunks 32x32 do `CamBatchExtractPage`
- No upload, enviar cada tile individualmente via `merge_cam_tile(x, y, z, items)`
- Manter batch de 50 tiles por vez para performance

#### 2. Nova funcao SQL `compact_tiles_to_chunks`

```text
Funcao: compact_tiles_to_chunks(p_floor integer)
1. TRUNCATE cam_map_chunks WHERE z = p_floor (ou DELETE)
2. SELECT x, y, z, items FROM cam_map_tiles WHERE z = p_floor
3. Agrupa por chunk 8x8: chunk_x = x / 8, chunk_y = y / 8
4. Monta JSON: {"relX,relY": [items]} para cada tile
5. INSERT INTO cam_map_chunks
```

#### 3. `CamBatchExtractPage.tsx` - Fluxo atualizado

- Upload de tiles individuais (sem chunking no JS)
- Ao final do processamento de todos os arquivos, chamar `compact_tiles_to_chunks` automaticamente para cada floor que teve dados
- Adicionar botao manual "Compactar Tiles" para re-compactar quando necessario

#### 4. `CamMapPage.tsx` - Ajustar DB_CHUNK para 8

- Mudar `DB_CHUNK = 8` (era 32)
- Simplificar `loadChunks` pois agora cada chunk do DB == 1 render chunk (sem redistribuicao)
- Simplificar `loadSpawns` para usar chunks 8x8 nos spawns tambem (ou manter spawns em 32x32 e redistribuir, que ja funciona)

#### 5. Ajustar `merge_cam_tile` para substituir ao inves de acumular

- Mudar a logica de merge: ao inves de UNION dos arrays, **substituir** os items se a nova lista for diferente, ou fazer UNION mas com deduplicacao mais agressiva
- Alternativa: usar `REPLACE` semantics - se o tile ja existe com os mesmos items, nao altera

---

### Arquivos a modificar

1. **`src/pages/CamBatchExtractPage.tsx`**: Trocar upload de chunks para upload de tiles individuais + compactacao automatica ao final
2. **Nova migracao SQL**: Funcao `compact_tiles_to_chunks(floor)` e ajuste no `merge_cam_tile`
3. **`src/pages/CamMapPage.tsx`**: Mudar `DB_CHUNK` de 32 para 8, simplificar `loadChunks`
4. **`src/lib/tibiaRelic/mapTileRenderer.ts`**: Sem mudancas (ja renderiza em 8x8)
5. **`src/lib/tibiaRelic/mapExtractor.ts`**: Sem mudancas (a extracao ja retorna tiles individuais, apenas o upload muda)

### Fluxo do usuario

1. Seleciona .cam files
2. Clica "Extrair Todos"
3. Para cada arquivo: extrai tiles individuais + salva no banco
4. Ao terminar todos: compacta automaticamente em chunks 8x8
5. Mapa carrega dos chunks 8x8 (rapido)

