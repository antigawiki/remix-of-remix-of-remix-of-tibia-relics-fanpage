

## Otimizacao: Pre-carregar todos os tiles do andar de uma vez

### Problema

O sistema atual busca tiles sob demanda em pequenos pedacos (chunks de 8x8) conforme o usuario navega. Mesmo com batch fetching, cada movimentacao no mapa gera novas queries ao banco. Alem disso, o Supabase tem um limite de 1000 linhas por query, o que pode cortar resultados silenciosamente.

### Solucao

Carregar TODOS os tiles do andar atual de uma vez na memoria, com paginacao para ultrapassar o limite de 1000 linhas. O Leaflet entao renderiza instantaneamente a partir da memoria local -- zero queries adicionais ao navegar/zoom.

### Fluxo

```text
Usuario troca de andar
        |
        v
[Preload] -- busca TODOS os tiles do andar
             em batches de 1000 (paginacao)
             com indicador de progresso
        |
        v
[Memoria] -- Map<"chunkX,chunkY", TileData[]>
             tudo indexado por chunk
        |
        v
[Leaflet] -- createTile busca do Map local
             renderizacao instantanea
             zero network requests
```

### Mudancas tecnicas

#### 1. Funcao `preloadFloor` com paginacao

Nova funcao que busca todos os tiles de um andar usando `.range()` em loops de 1000, ate nao ter mais dados. Agrupa tudo em um Map indexado por chunk key.

#### 2. Estado de loading por andar

Adicionar estado `floorLoading` para mostrar progresso enquanto carrega ("Carregando andar... 3000/87000 tiles"). O mapa so renderiza apos o preload terminar.

#### 3. Leaflet lê da memoria local

O `createTile` deixa de fazer fetch -- simplesmente consulta o Map local com os tiles pre-carregados. Renderizacao instantanea.

#### 4. Remover batch fetcher

O sistema de batch fetching fica desnecessario ja que tudo esta em memoria.

### Beneficios

- Navegacao instantanea apos o carregamento inicial
- Sem limite de 1000 linhas (paginacao resolve)
- Uma unica fase de loading clara em vez de tiles aparecendo gradualmente
- Zoom e pan sem nenhuma latencia de rede

