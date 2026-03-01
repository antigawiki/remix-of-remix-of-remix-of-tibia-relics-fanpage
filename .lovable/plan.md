

## Detectar Shovel Spots sem mapa explorado abaixo

### Conceito
Quando um tile no andar Z contém um ID de shovel spot (606, 593, 867, 868), significa que ali tem uma passagem para o andar Z+1 (abaixo). Se no andar Z+1 naquela mesma posicao (x, y) nao existem tiles no banco, significa que aquela area nunca foi explorada -- potencialmente um local secreto ou area nao acessada.

### Como funciona hoje
- O viewer carrega apenas 1 andar por vez (tiles + spawns de `cam_map_chunks`)
- Shovel spots sao marcados com borda amarela e letra "S"
- Nao ha nenhuma verificacao cruzada entre andares

### Solucao
Ao carregar o andar Z, tambem carregar uma lista leve de coordenadas que existem no andar Z+1. Isso permite distinguir visualmente:
- **Amarelo** (como hoje): shovel spot com mapa explorado abaixo
- **Vermelho/laranja**: shovel spot SEM mapa abaixo (area nao explorada!)

### Mudancas

**1. `CamMapPage.tsx` - Carregar posicoes do andar abaixo**
- Na funcao `preloadFloor`, alem de carregar tiles e spawns do andar Z, fazer uma query leve ao andar Z+1 buscando apenas as chaves de chunk existentes em `cam_map_chunks` (sem os tiles_data, apenas chunk_x e chunk_y)
- Armazenar esse conjunto de chunks existentes no andar de baixo em um novo ref (`belowChunksRef`)
- Passar essa informacao ao renderer

**2. `mapTileRenderer.ts` - Nova cor para shovel spots inexplorados**
- Adicionar opcao `belowTileKeys?: Set<string>` ao `renderChunk`
- Quando encontrar um shovel spot, verificar se existe tile data em (x, y, z+1) usando o set passado
- Se nao existir: renderizar com borda vermelha/laranja e letra "S!" em vez do amarelo normal
- Se existir: manter o amarelo atual

**3. `CamMapPage.tsx` - Toggle e legenda**
- Adicionar na legenda inferior: vermelho = "Shovel (inexplorado)"
- O indicador funciona automaticamente sem toggle extra (sempre visivel quando shovel spots estao visiveis)

### Detalhes tecnicos

Query leve para o andar abaixo (apenas chaves, sem dados pesados):
```typescript
// Buscar apenas quais chunks existem no andar Z+1
const { data } = await supabase
  .from('cam_map_chunks')
  .select('chunk_x, chunk_y')
  .eq('z', z + 1);
// Criar Set<string> com "chunkX,chunkY" para lookup O(1)
const belowChunks = new Set(data?.map(r => `${r.chunk_x},${r.chunk_y}`) ?? []);
```

No renderer, a verificacao cruzada:
```typescript
if (hasShovelSpot) {
  // Verificar se existe tile no andar de baixo
  const belowChunkKey = `${Math.floor(wx / 8)},${Math.floor(wy / 8)}`;
  const explored = belowTileKeys?.has(`${wx},${wy}`) ?? true;
  
  if (explored) {
    // Amarelo normal (como hoje)
    ctx.strokeStyle = '#ffcc00';
    ctx.fillText('S', ...);
  } else {
    // Vermelho = inexplorado!
    ctx.strokeStyle = '#ff4444';
    ctx.fillText('S!', ...);
  }
}
```

Para ter precisao no nivel do tile (nao apenas chunk), a query leve do andar abaixo precisa retornar os tiles_data keys de cada chunk. Alternativa mais eficiente: carregar apenas os chunk keys do andar abaixo (query pequena), e considerar que se o chunk inteiro nao existe, nenhum tile ali foi explorado. Se o chunk existe, assumir que aquela area foi explorada (granularidade de 8x8 tiles, suficiente para detectar areas secretas).

### O que NAO muda
- Upload de tiles e spawns: identico
- Geracao de mapa: identica
- Dados existentes: preservados
- Performance: impacto minimo (1 query leve extra por troca de andar)

