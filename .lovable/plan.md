

## Melhorias no Editor de Tiles

### 1. Seleção múltipla de tiles

**Problema:** Hoje ao clicar num tile, ele abre o painel de edição para aquele tile apenas. Ao salvar, fecha o painel e precisa clicar novamente.

**Solução:** Mudar o fluxo para um **modo de pintura**:
- Em edit mode, clicar num tile **aplica o sprite selecionado** diretamente (adiciona ao tile), sem abrir painel
- Botão direito ou Shift+click abre o painel de edição detalhada do tile (para remover items, substituir, etc.)
- Adicionar um seletor de "modo de pincel": **Adicionar** (append sprite), **Substituir** (replace all items), **Apagar** (remove top item)
- Cada click salva automaticamente no banco (batch upsert via debounce de ~500ms para múltiplos tiles editados rapidamente)
- Manter um `pendingEdits: Map<string, number[]>` que acumula edições e faz flush periódico

### 2. Cursor e highlight do tile

**Mudanças no `CamMapPage.tsx`:**

- **Cursor:** Quando `editMode=true`, adicionar classe CSS `cursor-crosshair` no map container div (linha 479-483). Leaflet usa `cursor: grab` via `.leaflet-container`, então precisamos de um override CSS: `.edit-mode .leaflet-container { cursor: crosshair !important; }` ou inline style.

- **Tile highlight:** Usar um `L.Rectangle` overlay que segue o mouse:
  - No `mousemove` handler (linha 274-288), quando em editMode, atualizar um `highlightRectRef` (L.Rectangle) para mostrar um quadrado de 1x1 tile na posição do mouse
  - Estilo: borda amarela/dourada semitransparente, fill quase transparente
  - Criar o rectangle uma vez e mover com `setBounds()` a cada mousemove

### 3. Click handler condicional

- Linha 290-303: O click handler atual sempre abre `editingTile`. Mudar para:
  - Se `editMode=false`: não fazer nada (ou manter o comportamento atual de mostrar info)
  - Se `editMode=true` e tem `selectedItemId`: aplicar o sprite ao tile e salvar
  - Se `editMode=true` e Shift pressionado: abrir painel de edição detalhada

### 4. Batch save com debounce

- Acumular tiles editados em um `pendingEditsRef`
- `setTimeout` de 500ms após última edição para fazer flush (upsert batch para `cam_map_tiles` + atualizar `cam_map_chunks`)
- Mostrar indicador "X tiles não salvos" no overlay inferior

### Mudanças por arquivo:

**`src/pages/CamMapPage.tsx`:**
- Novos estados: `brushMode` ('add' | 'replace' | 'erase'), `pendingEdits` ref
- Cursor: style condicional no map container `cursor: editMode ? 'crosshair' : undefined`
- CSS override para `.leaflet-container` dentro do map div quando editMode
- Highlight rectangle: criar `L.Rectangle` ref, atualizar bounds no mousemove
- Click handler: pintura direta quando editMode + selectedItemId, Shift+click para painel
- Batch save: debounced flush function
- Seletor de brush mode nos controles do edit mode (3 botõezinhos: Add/Replace/Erase)
- Indicador de pending saves no bottom overlay

**`src/components/cam-editor/TileEditPanel.tsx`:**
- Sem mudanças estruturais, mas agora só aparece com Shift+click

