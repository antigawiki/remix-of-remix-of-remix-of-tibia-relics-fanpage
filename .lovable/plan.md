

## Fix: Mapa some ao ativar modo de edicao

### Problema

Quando a `SpriteSidebar` aparece, o layout flex muda e o Leaflet perde as dimensoes do container. O `invalidateSize()` com 150ms nao e suficiente, e o container `absolute inset-0` pode acabar com dimensoes zero durante a transicao.

### Solucao

Mudar a sidebar de um elemento flex ao lado do mapa para um **overlay absoluto por cima do mapa**. Assim o container do mapa nunca muda de tamanho -- a sidebar fica flutuando sobre o mapa, como um painel lateral.

### Mudancas em `src/pages/CamMapPage.tsx`

1. **Remover a sidebar do fluxo flex**: em vez de renderizar a `SpriteSidebar` como irmao do map container dentro do flex, renderiza-la como um `div` com `position: absolute` dentro do container do mapa (ao lado do `TileEditPanel`).

2. **Remover o `useEffect` de `invalidateSize` no toggle de editMode** -- nao e mais necessario pois o mapa nao muda de tamanho.

3. Layout resultante:
```text
<div className="flex-1 relative">        ← map wrapper (nao muda)
  <div ref={mapContainerRef} />           ← leaflet (absolute inset-0, sempre)
  {editMode && <SpriteSidebar />}         ← absolute left-0, z-index alto
  {editMode && <TileEditPanel />}         ← absolute bottom, z-index alto
  ...overlays de controle...
</div>
```

A `SpriteSidebar` ja tem `h-full` -- basta adicionar `position: absolute, left: 0, top: 0, z-index: 1001` ao wrapper ou como prop/style no componente.

### Mudancas em `src/components/cam-editor/SpriteSidebar.tsx`

Adicionar classes de posicionamento absoluto ao container root: `absolute left-0 top-0 z-[1001]` (mantendo o `h-full`).

### Resultado

O mapa nunca e redimensionado. A sidebar flutua sobre o canto esquerdo do mapa. Sem necessidade de `invalidateSize`.

