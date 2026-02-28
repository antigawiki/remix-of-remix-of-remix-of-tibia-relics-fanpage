

## Diagnostico e Correcoes

Identifiquei 3 causas raiz para os problemas reportados:

### 1. Itens estruturais filtrados indevidamente (paredes, depots, bancadas)

**Causa**: Dois filtros excessivos estao descartando itens validos:

- **`buildFilteredTiles`** (mapExtractor.ts): Exige que itens com `stackPrio > 0` aparecam **2 ou mais vezes** nos snapshots para serem incluidos. Paredes e depots frequentemente aparecem apenas 1 vez por snapshot, sendo descartados.
- **`mapTileRenderer.ts`**: O renderer filtra itens com `stackPrio > 3`, mas a extracao permite ate `stackPrio 5`. Itens com stackPrio 4-5 sao extraidos mas nunca renderizados.

**Correcao**:
- Em `buildFilteredTiles`: Remover o requisito de `count >= 2`. Todos os itens extraidos devem ser incluidos (o filtro de `stackPrio <= 5` na extracao ja e suficiente).
- Em `mapTileRenderer.ts`: Aumentar o limite de `stackPrio > 3` para `stackPrio > 5`, alinhando com a extracao.

### 2. Spawns desapareceram (coordenadas desalinhadas)

**Causa**: O extrator (`mapExtractor.ts`) usa `DB_CHUNK = 32` para agrupar spawns, salvando `chunk_x = floor(x/32)`. Porem, o viewer (`CamMapPage.tsx`) agora usa `DB_CHUNK = 8`, calculando `dbBaseX = chunk_x * 8` ao inves de `chunk_x * 32`. Isso posiciona todas as criaturas nas coordenadas erradas.

**Correcao**: No `loadSpawns` do CamMapPage, usar o tamanho correto de 32 para calcular a base das posicoes dos spawns (ja que os spawns continuam sendo armazenados em chunks 32x32). Criar constante `SPAWN_DB_CHUNK = 32` separada.

### 3. Upload lento

**Causa**: Batch de 50 tiles por vez com `await Promise.all` sequencial.

**Correcao**:
- Aumentar `UPLOAD_BATCH` de 50 para 200 (mais RPCs em paralelo).
- Remover o `await` entre o upload de tiles e spawns, executando-os em paralelo quando possivel.

---

### Arquivos a modificar

1. **`src/lib/tibiaRelic/mapExtractor.ts`**: Remover filtro `count >= 2` em `buildFilteredTiles`
2. **`src/lib/tibiaRelic/mapTileRenderer.ts`**: Mudar `stackPrio > 3` para `stackPrio > 5`
3. **`src/pages/CamMapPage.tsx`**: Corrigir `loadSpawns` para usar chunk size 32 nos calculos de posicao
4. **`src/pages/CamBatchExtractPage.tsx`**: Aumentar `UPLOAD_BATCH` para 200

