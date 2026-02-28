

## Mostrar criaturas vivas no Cam Map (e remover cadaveres)

### O que muda

Atualmente o extrator salva apenas **itens** de cada tile, o que inclui cadaveres (corpos de criaturas mortas que viram itens no chao). As criaturas vivas sao ignoradas. O objetivo e inverter isso: capturar as criaturas vivas e suas posicoes, e filtrar cadaveres dos itens.

### Fluxo

```text
Extracao (.cam)
     |
     v
[Items do tile] -- filtra cadaveres (items que so aparecem em alguns frames)
[Criaturas]     -- coleta nome + outfit + posicao de cada criatura viva
     |
     v
[Banco de dados]
  cam_map_tiles   -- items sem cadaveres
  cam_map_creatures (NOVA) -- spawns de criaturas
     |
     v
[Renderer] -- desenha items + sprites de criaturas por cima
```

### Mudancas tecnicas

#### 1. Nova tabela `cam_map_creatures`

Armazena criaturas encontradas durante a extracao. Usa UPSERT por coordenada + nome para evitar duplicatas.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| x | integer | Coordenada X (PK composta) |
| y | integer | Coordenada Y (PK composta) |
| z | integer | Andar (PK composta) |
| name | text | Nome da criatura (PK composta) |
| outfit_id | integer | ID do outfit no DAT |
| direction | integer | Direcao (0-3) |
| updated_at | timestamptz | Ultima atualizacao |

RLS: SELECT publico, INSERT/UPDATE publico (mesmo padrao de cam_map_tiles).

#### 2. Extrator (`mapExtractor.ts`)

- **Coletar criaturas**: alem de items, extrair de `gs.creatures` todas as criaturas com `health > 0` (vivas), salvando nome, outfit, posicao e direcao.
- **Filtrar cadaveres**: usar heuristica de persistencia -- items que aparecem consistentemente em multiplos snapshots sao mantidos; items que aparecem esporadicamente (cadaveres que decaem) sao descartados. Na pratica, manter um contador por tile+itemId e so incluir no resultado final items vistos em pelo menos 2 snapshots diferentes.
- Retornar dois Maps: um de tiles (items) e outro de criaturas.

#### 3. Upload no Player (`TibiarcPlayer.tsx`)

- Apos a extracao, fazer upsert dos tiles (como ja faz) E upsert das criaturas na nova tabela `cam_map_creatures`.

#### 4. Cam Map Page (`CamMapPage.tsx`)

- No `preloadFloor`, tambem buscar criaturas do andar atual da tabela `cam_map_creatures`.
- Passar dados de criaturas para o renderer.

#### 5. Renderer (`mapTileRenderer.ts`)

- Adicionar metodo `drawCreature` que renderiza o outfit da criatura usando sprites do DatLoader (frame 0, sem animacao).
- Apos desenhar os items de um tile, desenhar as criaturas naquela posicao por cima.
- Usar a mesma logica de sprite indexing do Renderer principal (direction mapping, layers, patX/patY), porem simplificada (sem animacao, sem tinting de cores).

### Resultado esperado

- O mapa mostra o terreno limpo (sem corpos no chao)
- Criaturas vivas aparecem nos locais onde foram vistas, como "spawns" estaticos
- Multiplas cams do mesmo local acumulam criaturas diferentes encontradas

