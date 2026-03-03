

## Integrar Editor diretamente no CamMapPage

### Abordagem

Em vez de uma pagina separada (que tem problemas de inicializacao do Leaflet), adicionar um **modo de edicao** ao `CamMapPage.tsx` existente. Um botao "Editar" no overlay ativa o modo, que:
- Abre uma sidebar esquerda com o catalogo de sprites (busca por ID + grid virtual)
- Muda o comportamento do click no mapa: em vez de apenas mostrar coords, abre painel de edicao do tile clicado
- Um botao "Sair" desativa o modo e esconde a sidebar

### Mudancas

#### 1. `src/pages/CamMapPage.tsx` - Adicionar modo de edicao

**Novos estados:**
- `editMode: boolean` - controla se o editor esta ativo
- `selectedItemId: number | null` - item selecionado na sidebar
- `editingTile: { x, y, z, items } | null` - tile sendo editado
- `searchId: string` - filtro de busca por ID na sidebar
- `sidebarScrollTop: number` - para virtualizacao do grid

**Sidebar (condicional, so aparece em editMode):**
- Div fixa a esquerda (~280px), com input de busca e grid virtual de sprites
- Usa `rendererRef.current.renderSingleSprite(itemId)` para renderizar cada sprite
- Ao clicar num sprite, seta `selectedItemId`
- O map container ajusta com `margin-left` ou flex

**Click handler do mapa (editMode):**
- Ao clicar, pega x/y/z e items atuais do `floorDataRef`
- Mostra painel flutuante (overlay) com:
  - Lista dos items atuais (sprites renderizados + botao remover cada)
  - Botao "Adicionar" (usa selectedItemId)
  - Botao "Substituir todos" (usa selectedItemId)
  - Botao "Salvar" -> upsert no `cam_map_tiles` com `seen_count=999`, atualiza `cam_map_chunks`, re-renderiza chunk

**Botao de ativar/desativar:**
- No overlay de controles (top-right), adicionar botao "✏️ Editar" que toggle `editMode`
- Ao ativar, `map.invalidateSize()` apos sidebar aparecer

#### 2. Ajuste de layout

Quando `editMode=true`:
- Layout muda de `<div className="flex-1 relative">` para `<div className="flex-1 flex"><sidebar /><div className="flex-1 relative">map</div></div>`
- Chamar `map.invalidateSize()` no useEffect que observa `editMode`

#### 3. Remover `CamMapEditorPage.tsx` e rota

- Deletar `src/pages/CamMapEditorPage.tsx`
- Remover rota `/f9a2c8d4e7b1/editor` do `App.tsx`
- Remover link "Editor" do header do CamMapPage (substituir pelo botao inline)

### Vantagem

O mapa ja esta inicializado e funcionando. A sidebar e apenas um overlay/panel que aparece ao lado — sem precisar reinicializar o Leaflet.

