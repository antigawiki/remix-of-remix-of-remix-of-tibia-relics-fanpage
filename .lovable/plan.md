

## Corrigir timeout na geracao dos andares 7 e 8

### O que esta acontecendo
Os andares 7 e 8 sao os mais densos (nivel do chao, cidades, etc). A funcao SQL `compact_tiles_to_chunks` processa lotes de 50 valores de `chunk_x` por vez, mas mesmo assim o volume total de dados nesses andares causa timeout no banco. O retry tambem falha pelo mesmo motivo.

### Solucao
Dividir a compactacao em faixas menores chamadas diretamente do frontend, em vez de depender de uma unica chamada SQL que processa o andar inteiro.

### Mudancas

**1. Nova funcao SQL: `compact_tiles_range`**
- Recebe `p_floor`, `p_min_cx`, `p_max_cx` (faixa de chunk_x a processar)
- Processa apenas os chunks dentro dessa faixa, sem loop interno
- Deleta apenas os chunks existentes nessa faixa antes de inserir
- Retorna o numero de chunks criados

**2. Atualizar `generateMap` no frontend (`CamBatchExtractPage.tsx`)**
- Para cada andar, primeiro consulta o range de `chunk_x` existente no `cam_map_tiles`
- Divide esse range em fatias de 20 unidades de `chunk_x`
- Chama `compact_tiles_range(floor, min_cx, max_cx)` para cada fatia
- Atualiza o progresso mostrando "Andar X - fatia Y/Z"
- Remove a logica de retry (nao sera mais necessaria com fatias pequenas)

### Detalhes tecnicos

```sql
-- compact_tiles_range: processa uma faixa especifica de chunk_x
CREATE FUNCTION compact_tiles_range(p_floor int, p_min_cx int, p_max_cx int)
RETURNS integer AS $$
BEGIN
  DELETE FROM cam_map_chunks
  WHERE z = p_floor AND chunk_x >= p_min_cx AND chunk_x <= p_max_cx;

  INSERT INTO cam_map_chunks (chunk_x, chunk_y, z, tiles_data, updated_at)
  SELECT floor(x/8)::int, floor(y/8)::int, p_floor,
    jsonb_object_agg(...), now()
  FROM cam_map_tiles
  WHERE z = p_floor
    AND floor(x/8)::int >= p_min_cx AND floor(x/8)::int <= p_max_cx
  GROUP BY floor(x/8)::int, floor(y/8)::int;

  RETURN found_count;
END;
$$
```

No frontend, o fluxo passa a ser:
```
Para cada andar (0-15):
  1. SELECT min(floor(x/8)), max(floor(x/8)) FROM cam_map_tiles WHERE z = andar
  2. Dividir [min, max] em fatias de 20
  3. Para cada fatia: chamar compact_tiles_range(andar, fatia_min, fatia_max)
  4. Atualizar progresso
```

Isso garante que nenhuma chamada individual processe mais que ~20*8 = 160 colunas de tiles, eliminando o timeout mesmo nos andares mais densos.

