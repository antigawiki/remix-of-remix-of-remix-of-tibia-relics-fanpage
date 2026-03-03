

## Editor de Tiles do Cam Map

### Conceito

Nova pagina `/f9a2c8d4e7b1/editor` com layout dividido: sidebar esquerda com catalogo de tiles (renderizados via SprLoader/DatLoader) e mapa Leaflet a direita. Workflow: selecionar tile no catalogo -> clicar no mapa -> tile e substituido na posicao clicada.

### Arquitetura

```text
┌──────────────┬──────────────────────────────────┐
│  Sidebar     │                                  │
│  ┌────────┐  │         Mapa Leaflet             │
│  │Search  │  │    (mesmo do CamMapPage)          │
│  └────────┘  │                                  │
│  ┌──┬──┬──┐  │   Click no tile = abre popup     │
│  │  │  │  │  │   com items atuais + opcao de    │
│  ├──┼──┼──┤  │   adicionar/remover/substituir   │
│  │  │  │  │  │                                  │
│  ├──┼──┼──┤  │                                  │
│  │  │  │  │  │                                  │
│  └──┴──┴──┘  │                                  │
│  Grid de     │                                  │
│  sprites     │                                  │
│  (32x32 cada)│                                  │
└──────────────┴──────────────────────────────────┘
```

### Mudancas

#### 1. Novo arquivo: `src/pages/CamMapEditorPage.tsx`

- Reutiliza a logica de carregamento de assets (SprLoader, DatLoader) e floor data do CamMapPage
- **Sidebar esquerda**:
  - Input de busca por ID (filtra o grid)
  - Grid virtual de todos os item IDs do DatLoader (100 ate itemMaxId)
  - Cada celula mostra o sprite 32x32 renderizado + ID abaixo
  - Ao clicar, seleciona o tile (borda dourada de highlight)
  - Estado: `selectedItemId: number | null`
- **Mapa (direita)**:
  - Mesmo Leaflet tile layer do CamMapPage (reusa getChunkTiles, renderer, etc.)
  - Ao clicar num tile do mapa:
    - Popup/modal mostra os item IDs atuais nessa posicao (lista com sprites)
    - Botoes: "Adicionar item selecionado", "Substituir todos por selecionado", "Remover item X"
    - Ao confirmar, faz UPDATE diretamente no `cam_map_tiles` via supabase e atualiza o floorData local + re-renderiza o chunk afetado

#### 2. Funcao de renderizacao de sprite individual

Adicionar um metodo utilitario (ou reutilizar o que o MapTileRenderer ja faz internamente) para renderizar um unico item sprite num canvas 32x32, para usar no catalogo da sidebar. O `spriteCanvasCache` do MapTileRenderer ja faz isso - expor via metodo publico.

#### 3. Persistencia das edicoes

Ao editar um tile, chamar diretamente:
```sql
UPDATE cam_map_tiles SET items = '[novo_array]', seen_count = 999, updated_at = now()
WHERE x = X AND y = Y AND z = Z
```

O `seen_count = 999` garante que nenhuma extracao futura sobrescreva a correcao manual (o sistema de confianca preserva tiles com seen_count > 1).

Se o tile nao existe ainda, fazer INSERT.

Tambem atualizar o chunk correspondente em `cam_map_chunks` para que a mudanca apareca no mapa viewer sem precisar recompactar.

#### 4. Rota no App.tsx

Adicionar: `<Route path="/f9a2c8d4e7b1/editor" element={<CamMapEditorPage />} />`

E link no CamMapPage header.

#### 5. Detalhes da sidebar

- Range de IDs: 100 ate ~ultimo ID do DatLoader (tipicamente ~3000+)
- Grid com ~6 colunas de sprites 32x32
- Scroll virtual (renderizar apenas ~100 itens visiveis) para nao sobrecarregar com milhares de sprites
- Busca por ID: input numerico que filtra/scrolla ate o ID
- Ao passar mouse sobre sprite, tooltip com ID

### Arquivos afetados

| Arquivo | Acao |
|---------|------|
| `src/pages/CamMapEditorPage.tsx` | Criar - pagina principal do editor |
| `src/lib/tibiaRelic/mapTileRenderer.ts` | Editar - expor metodo `renderSingleSprite(itemId)` |
| `src/App.tsx` | Editar - adicionar rota |
| `src/pages/CamMapPage.tsx` | Editar - adicionar link para editor no header |

