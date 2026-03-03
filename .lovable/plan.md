

## Sistema de Confianca para Tiles do Cam Map

### Problema
Tiles de andares errados aparecem no mapa porque uma unica cam com dados incorretos sobrescreve os dados corretos (last-write-wins).

### Solucao: Contagem de ocorrencias por tile

Adicionar um campo `seen_count` na tabela `cam_map_tiles` que incrementa a cada vez que a mesma combinacao `(x, y, z, items)` e enviada. Quando uma cam envia items diferentes para a mesma posicao, o sistema compara: se os items novos sao diferentes dos atuais, so sobrescreve se o `seen_count` atual for 1 (ou seja, foi visto apenas uma vez). Caso contrario, incrementa o contador dos items existentes, validando que eles sao os corretos.

### Mudancas

#### 1. Migration: adicionar `seen_count` a `cam_map_tiles`

```sql
ALTER TABLE cam_map_tiles ADD COLUMN seen_count integer NOT NULL DEFAULT 1;
```

#### 2. Migration: atualizar `merge_cam_tiles_batch`

Nova logica do upsert:
- Se o tile NAO existe: insere com `seen_count = 1`
- Se o tile JA existe e os `items` sao IGUAIS: incrementa `seen_count`
- Se o tile JA existe e os `items` sao DIFERENTES:
  - Se o `seen_count` atual for 1 (visto apenas 1 vez = pouca confianca): sobrescreve com os novos items e reseta `seen_count = 1`
  - Se o `seen_count` atual for > 1 (multiplas confirmacoes = alta confianca): mantém os items atuais e apenas incrementa `seen_count` (os dados corretos vencem)

```sql
INSERT INTO cam_map_tiles (x, y, z, items, seen_count, updated_at)
SELECT x, y, z, items, 1, now()
FROM jsonb_to_recordset(tiles) AS t(x int, y int, z int, items jsonb)
ON CONFLICT (x, y, z) DO UPDATE SET
  items = CASE
    WHEN cam_map_tiles.items = EXCLUDED.items THEN cam_map_tiles.items
    WHEN cam_map_tiles.seen_count <= 1 THEN EXCLUDED.items
    ELSE cam_map_tiles.items
  END,
  seen_count = CASE
    WHEN cam_map_tiles.items = EXCLUDED.items THEN cam_map_tiles.seen_count + 1
    WHEN cam_map_tiles.seen_count <= 1 THEN 1
    ELSE cam_map_tiles.seen_count + 1
  END,
  updated_at = now();
```

#### 3. Nenhuma mudanca no frontend

O `CamBatchExtractPage.tsx` ja envia os tiles no formato correto. A logica de confianca e toda no banco.

### Como funciona na pratica

```text
Cam 1 envia tile (32100, 31500, 8) = [450, 102]   → insere, seen_count = 1
Cam 2 envia tile (32100, 31500, 8) = [450, 102]   → mesmo items, seen_count = 2
Cam 3 envia tile (32100, 31500, 8) = [351, 103]   → items diferentes, seen_count=2 > 1, MANTÉM [450,102], seen_count = 3
Cam 4 envia tile (32100, 31500, 8) = [450, 102]   → mesmo items, seen_count = 4
```

O tile errado da Cam 3 (grama de superficie no andar 8) e ignorado porque o tile correto ja foi confirmado 2+ vezes.

### Limitacao e consideracao

- Tiles que foram inseridos apenas 1 vez (seen_count=1) ainda podem ser sobrescritos por dados errados. Isso e intencional: com apenas 1 observacao, nao temos confianca suficiente para preservar.
- Apos processar multiplas cams, os dados se auto-corrigem naturalmente.

