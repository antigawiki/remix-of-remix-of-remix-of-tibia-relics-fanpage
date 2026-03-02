

## Corrigir Geracao de Mapa para Grande Volume de Dados

### Problema

Com ~1000 arquivos .cam extraidos, a tabela `cam_map_tiles` pode ter centenas de milhares de linhas. O botao "Gerar Mapa" atualmente:
1. Le **todos** os tiles para o navegador via SELECT paginado (1000 por vez)
2. Agrupa em chunks de 8x8 no JavaScript
3. Envia de volta para o banco

Com esse volume, o processo trava por excesso de memoria no navegador ou timeout nas requisicoes. Cada andar pode ter dezenas de milhares de tiles, resultando em centenas de paginas de leitura.

### Solucao: Mover a logica para o banco de dados

Criar uma funcao SQL `generate_map_chunks(p_floor integer)` que faz tudo server-side:
- Agrupa os tiles de `cam_map_tiles` por chunk (floor(x/8), floor(y/8))
- Constroi o JSONB de cada chunk
- Faz UPSERT em `cam_map_chunks`
- Retorna quantidade de chunks gerados

O frontend apenas chama essa funcao uma vez por andar (0-15), eliminando a transferencia massiva de dados.

### Implementacao

**1. Migration SQL - Criar funcao `generate_map_chunks`**

```sql
CREATE OR REPLACE FUNCTION generate_map_chunks(p_floor integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  chunk_count integer := 0;
  chunk_rec RECORD;
BEGIN
  FOR chunk_rec IN
    SELECT
      floor(x / 8)::integer AS cx,
      floor(y / 8)::integer AS cy,
      jsonb_object_agg(
        (x - floor(x/8)::integer * 8) || ',' || (y - floor(y/8)::integer * 8),
        items
      ) AS data
    FROM cam_map_tiles
    WHERE z = p_floor
    GROUP BY floor(x / 8)::integer, floor(y / 8)::integer
  LOOP
    INSERT INTO cam_map_chunks (chunk_x, chunk_y, z, tiles_data, updated_at)
    VALUES (chunk_rec.cx, chunk_rec.cy, p_floor, chunk_rec.data, now())
    ON CONFLICT (chunk_x, chunk_y, z)
    DO UPDATE SET tiles_data = EXCLUDED.tiles_data, updated_at = now();

    chunk_count := chunk_count + 1;
  END LOOP;

  RETURN chunk_count;
END;
$$;
```

**2. Editar `CamBatchExtractPage.tsx` - Simplificar `generateMap`**

Substituir toda a logica de leitura paginada + agrupamento JS por um loop simples:

```typescript
const generateMap = async () => {
  setGenerating(true);
  let totalChunks = 0;
  const failedFloors: number[] = [];

  try {
    for (let z = 0; z <= 15; z++) {
      if (abortRef.current) break;
      setCompactStatus(`Gerando andar ${z}...`);

      const { data, error } = await supabase.rpc(
        'generate_map_chunks' as any,
        { p_floor: z }
      );

      if (error) {
        console.error(`Floor ${z} error:`, error);
        failedFloors.push(z);
        continue;
      }

      const chunks = data as number;
      totalChunks += chunks;
      setCompactStatus(`Andar ${z}: ${chunks} chunks`);
    }

    if (failedFloors.length > 0) {
      toast.error(`Erro nos andares: ${failedFloors.join(', ')}`);
    } else {
      toast.success(`Mapa gerado! ${totalChunks} chunks.`);
    }
  } catch (err) {
    toast.error('Erro ao gerar mapa');
  } finally {
    setCompactStatus('');
    setGenerating(false);
  }
};
```

### Beneficios
- Processamento 100% no banco, sem transferir dados para o navegador
- Cada andar e uma unica chamada RPC
- Funciona com qualquer volume de tiles (100k+)
- Tempo de execucao drasticamente reduzido

### Arquivos

| Arquivo | Acao |
|---|---|
| Migration SQL | CRIAR funcao `generate_map_chunks` |
| `src/pages/CamBatchExtractPage.tsx` | EDITAR funcao `generateMap` (simplificar) |

