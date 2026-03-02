

## Corrigir perda massiva de tiles no upload (5-10% salvos)

### Causa raiz

A função SQL `merge_cam_tiles_batch` executa um **loop PL/pgSQL com INSERT individual** para cada tile:

```sql
FOR t IN SELECT * FROM jsonb_array_elements(tiles) LOOP
    INSERT INTO cam_map_tiles ... ON CONFLICT ... DO UPDATE ...
END LOOP;
```

Com 200 tiles por batch e 300k tiles totais = **1500 chamadas RPC sequenciais**, cada uma executando 200 INSERTs individuais. Qualquer chamada que exceda o timeout falha silenciosamente, mesmo com retries, porque a operacao inteira e lenta demais.

### Solucao em 2 partes

#### 1. Migracao SQL: Reescrever `merge_cam_tiles_batch` com bulk INSERT

Substituir o loop por uma unica operacao `INSERT ... SELECT FROM jsonb_to_recordset(...)`:

```sql
CREATE OR REPLACE FUNCTION public.merge_cam_tiles_batch(tiles jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected integer;
BEGIN
  INSERT INTO cam_map_tiles (x, y, z, items, updated_at)
  SELECT
    (t.x)::integer,
    (t.y)::integer,
    (t.z)::integer,
    t.items,
    now()
  FROM jsonb_to_recordset(tiles) AS t(x integer, y integer, z integer, items jsonb)
  ON CONFLICT (x, y, z) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
```

Isso e **10-50x mais rapido** que o loop porque o Postgres executa tudo em uma unica operacao bulk. A funcao agora retorna o numero de rows afetadas para validacao.

#### 2. Frontend: Upload paralelo + contadores de sucesso/falha

Modificar `src/pages/CamBatchExtractPage.tsx`:

- **Aumentar batch para 500** tiles (possivel com o bulk INSERT rapido)
- **Upload paralelo**: enviar 3 batches simultaneamente com `Promise.all`
- **Contadores visiveis**: mostrar na UI quantos tiles foram salvos vs falharam
- **Usar o retorno da RPC** para validar quantos tiles foram realmente inseridos

```text
Mudancas no arquivo:
- TILE_RPC_BATCH: 200 -> 500
- Adicionar PARALLEL_UPLOADS = 3
- Loop de upload: processar 3 batches por vez com Promise.all
- Acumular totalSaved e totalFailed a partir do retorno da RPC
- Exibir contadores na UI durante e apos o upload
```

### Arquivos modificados

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| Migracao SQL | DB | Reescrever `merge_cam_tiles_batch` com bulk INSERT, retornar row count |
| `src/pages/CamBatchExtractPage.tsx` | Frontend | Batch 500, upload paralelo x3, contadores sucesso/falha |

### Resultado esperado

- **300k tiles em ~1-2 min** (vs 12+ min antes)
- **Zero perda silenciosa**: cada batch retorna quantos tiles salvou
- **Visibilidade**: contadores na UI mostram exatamente o que foi salvo vs falhou

