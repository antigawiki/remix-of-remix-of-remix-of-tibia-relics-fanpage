

## Melhorias no Cam Map: Merge de tiles + Mapa externo como base

### 1. Merge em vez de substituir na extracao

**Problema atual**: O upsert com `onConflict: 'x,y,z'` sobrescreve os items do tile existente. Se duas cams cobrem a mesma area, a segunda apaga os dados da primeira.

**Solucao**: Usar uma funcao SQL no banco que faz merge dos arrays de items. Ao inserir um tile que ja existe, os item IDs novos sao adicionados ao array existente (uniao sem duplicatas), preservando tudo que ja foi descoberto.

- Criar uma funcao SQL `merge_cam_tile(px, py, pz, new_items)` que faz:
  - Se o tile nao existe: INSERT normal
  - Se ja existe: UPDATE combinando os items existentes com os novos (uniao sem duplicatas via `array_agg(DISTINCT ...)`)
- Alterar o `TibiarcPlayer.tsx` para chamar essa funcao via `supabase.rpc()` em vez de upsert direto
- As criaturas continuam com upsert normal (faz sentido sobrescrever pois a ultima observacao e a mais recente)

### 2. Mapa externo como camada base (fallback)

**Descoberta**: O mapa do opentibia.info usa tiles PNG pre-renderizados hospedados em `https://st54085.ispot.cc/mapper/tibiarelic/{zoom}/{z}/{x}_{y}.png`. Sao imagens prontas que podemos usar como camada de fundo.

**Solucao**: Adicionar uma camada `L.TileLayer` do Leaflet que carrega diretamente essas imagens como base. O Cam Map renderizado localmente (com sprites) sera desenhado por cima como overlay. Onde nao houver dados de cam, o usuario vera o mapa externo.

- Adicionar uma `L.TileLayer` apontando para o tile server externo como camada base
- Manter o `L.GridLayer` customizado como overlay (cam data por cima)
- Mapear corretamente as coordenadas do Leaflet para o padrao `{zoom}/{z}/{x}_{y}.png` do servidor externo
- Adicionar toggle na UI para mostrar/esconder a camada base

### Mudancas tecnicas

#### Banco de dados
- Nova funcao SQL `merge_cam_tile` que recebe `(x, y, z, items jsonb)` e faz merge inteligente dos arrays

#### `src/components/TibiarcPlayer.tsx`
- Substituir `supabase.from('cam_map_tiles').upsert(...)` por chamadas em batch a `supabase.rpc('merge_cam_tile', ...)`

#### `src/pages/CamMapPage.tsx`
- Adicionar `L.TileLayer` base com URL do mapa externo
- Mapear coordenadas Leaflet para o formato do tile server (zoom/z/x_y.png)
- Adicionar botao toggle para camada base
- Manter GridLayer customizado como overlay

### Resultado esperado
- Multiplas cams do mesmo local acumulam descobertas em vez de sobrescrever
- O mapa mostra o mundo completo (via imagens externas) com detalhes das cams sobrepostos
- Usuario ve um mapa rico desde o inicio, mesmo sem ter extraido muitas cams

