

## Plano: Sistema de Mapeamento de Spawns por Area

### Conceito

Em vez de registrar cada criatura individual (que gera problemas com mortes, duplicatas e poluicao visual), o sistema vai agregar dados de spawn por regiao. Quando o jogador passa por uma area, o extrator conta quantas criaturas de cada tipo aparecem ali. Apos multiplas passagens pela mesma area, os dados se consolidam mostrando o spawn real: "nesta regiao nascem 2 Ghouls e 1 Skeleton".

### Design

#### Nova tabela: `cam_map_spawns`

Armazena dados agregados de spawn por chunk (32x32 tiles, mesmo grid dos tiles):

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| chunk_x | integer | Coordenada X do chunk (tile_x / 32) |
| chunk_y | integer | Coordenada Y do chunk (tile_y / 32) |
| z | integer | Andar |
| creature_name | text | Nome da criatura |
| outfit_id | integer | ID do outfit para renderizar sprite |
| avg_count | real | Quantidade media vista por passagem |
| positions | jsonb | Array de posicoes relativas dentro do chunk `[{x,y}]` |
| visit_count | integer | Quantas vezes o jogador passou por este chunk |
| updated_at | timestamptz | Ultima atualizacao |

Chave primaria composta: `(chunk_x, chunk_y, z, creature_name)`

#### Logica de Extracao (mapExtractor.ts)

1. **Detectar "visitas" a chunks**: Cada vez que `camX/camY` entra em um novo chunk de 32x32, marca como uma visita a esse chunk
2. **Contar criaturas por visita**: Para cada visita, registra quantas criaturas vivas de cada tipo estao na viewport, agrupadas por chunk
3. **Agregar**: No final da extracao, calcula a media de criaturas por tipo por visita para cada chunk
4. **Posicoes**: Armazena as posicoes relativas (dentro do chunk 0-31) onde cada tipo de criatura foi mais frequentemente vista

O filtro de criaturas continua o mesmo: ignora players (outfit colors customizadas, outfits 128-143), ignora o jogador gravando, ignora criaturas mortas (health <= 0).

#### Funcao SQL de Merge

Como multiplas .cam podem cobrir a mesma area, uma funcao `merge_cam_spawn` faz media ponderada:
- Se ja existe registro para aquele chunk+criatura, recalcula a media considerando o visit_count anterior
- Novas posicoes sao adicionadas ao array (com dedup)

#### Renderizacao (mapTileRenderer.ts)

- Para cada chunk visivel, consulta os spawns daquele chunk
- Renderiza os sprites das criaturas nas posicoes armazenadas
- Se avg_count > 1, posiciona multiplos sprites lado a lado com espacamento de ~3-4 tiles
- Se nao ha posicoes suficientes para a quantidade, distribui em grid dentro do chunk

#### Substituicao da tabela antiga

A tabela `cam_map_creatures` atual sera substituida por `cam_map_spawns`. O codigo de upload e visualizacao sera atualizado para usar a nova tabela.

---

### Arquivos Modificados

1. **Migracao SQL**: Criar tabela `cam_map_spawns` + funcao `merge_cam_spawn` + RLS policies
2. **`src/lib/tibiaRelic/mapExtractor.ts`**: Refatorar extracao de criaturas para agregar por chunk com contagem por visita. Nova interface `SpawnData` e nova logica de snapshot baseada em visitas
3. **`src/pages/CamMapPage.tsx`**: Atualizar upload para salvar na nova tabela e atualizar carregamento para ler de `cam_map_spawns`
4. **`src/lib/tibiaRelic/mapTileRenderer.ts`**: Atualizar `renderChunk` para receber spawns agregados e posicionar multiplos sprites com espacamento

### Resultado Esperado

- Mapa limpo mostrando apenas spawns confirmados (vistos em multiplas passagens)
- Quantidade correta de cada tipo de criatura por area
- Sprites posicionados de forma organizada sem sobreposicao
- Criaturas mortas nunca aparecem (so conta health > 0)
- Dados se acumulam de multiplas .cam files sem duplicar

