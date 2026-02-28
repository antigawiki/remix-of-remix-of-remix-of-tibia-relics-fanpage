

## Mover a compactacao de tiles para o frontend

### Problema
A funcao SQL `compact_tiles_range` ainda da timeout nos andares densos (7, 8) porque faz `jsonb_object_agg` + `GROUP BY` sobre milhares de linhas. Qualquer solucao SQL vai ter esse risco conforme o volume cresce.

### Solucao
Substituir a compactacao SQL por logica no frontend:
1. Ler tiles do banco em paginas (1000 por vez via SELECT)
2. Agrupar em chunks de 8x8 no JavaScript (trivial e instantaneo)
3. Salvar os chunks via `merge_cam_chunks_batch` (RPC que ja existe e faz merge inteligente)

O upload de tiles continua exatamente como esta. Nenhuma tabela e apagada. Nenhum dado e perdido.

### Mudancas

**1. `CamBatchExtractPage.tsx` - Reescrever `generateMap`**

O novo fluxo:
```text
Para cada andar (0-15):
  1. SELECT x, y, items FROM cam_map_tiles WHERE z = andar (paginado, 1000 por vez)
  2. No JS: agrupar tiles por chunk_x = floor(x/8), chunk_y = floor(y/8)
     - Chave relativa: "relX,relY" -> items (igual ao formato atual de tiles_data)
  3. Enviar chunks agrupados via merge_cam_chunks_batch em lotes de 200
  4. Mostrar progresso: "Andar X - lendo tiles..." / "Andar X - salvando chunks Y/Z"
```

Beneficios:
- Nenhuma operacao SQL pesada (apenas SELECTs simples paginados + INSERTs via RPC existente)
- Funciona com qualquer volume de dados sem timeout
- Preserva 100% da qualidade e detalhes (mesmos dados, mesmo formato)
- Nao apaga nenhuma tabela, nao exige re-upload
- O viewer (`CamMapPage.tsx`) continua lendo de `cam_map_chunks` sem mudanca alguma

**2. Remover dependencia de funcoes SQL de compactacao**
- `generateMap` nao chamara mais `compact_tiles_range` nem `compact_tiles_to_chunks`
- As funcoes SQL continuam existindo (nao precisa apagar), apenas nao serao mais usadas

### Detalhes tecnicos

```typescript
// Pseudocodigo do novo generateMap
const generateMap = async () => {
  for (let z = 0; z <= 15; z++) {
    // Fase 1: Ler todos os tiles deste andar
    const chunkMap = new Map<string, Record<string, number[]>>();
    let offset = 0;
    while (true) {
      const { data } = await supabase
        .from('cam_map_tiles')
        .select('x, y, items')
        .eq('z', z)
        .range(offset, offset + 999);
      if (!data || data.length === 0) break;
      
      for (const tile of data) {
        const cx = Math.floor(tile.x / 8);
        const cy = Math.floor(tile.y / 8);
        const key = `${cx},${cy}`;
        const relKey = `${tile.x - cx * 8},${tile.y - cy * 8}`;
        let chunk = chunkMap.get(key) || {};
        chunk[relKey] = tile.items;
        chunkMap.set(key, chunk);
      }
      offset += 1000;
    }

    // Fase 2: Salvar chunks via RPC existente
    const entries = Array.from(chunkMap.entries());
    for (let j = 0; j < entries.length; j += 200) {
      const batch = entries.slice(j, j + 200).map(([k, data]) => {
        const [cx, cy] = k.split(',').map(Number);
        return { cx, cy, z, data };
      });
      await supabase.rpc('merge_cam_chunks_batch', { chunks: batch });
    }
  }
};
```

### O que NAO muda
- Upload de tiles (.cam -> cam_map_tiles): identico
- Upload de spawns (.cam -> cam_map_spawns): identico
- Viewer (CamMapPage): le de cam_map_chunks como antes
- Tabelas do banco: nenhuma alteracao de schema
- Dados existentes: preservados integralmente
