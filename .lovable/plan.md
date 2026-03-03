

## Fix: Mapa nao carrega no Tile Editor

### Problema

O container do mapa (`ref={mapContainerRef}`) e renderizado condicionalmente — so aparece quando `assetsLoading` e false. Isso causa um problema: quando o Leaflet tenta se inicializar, o container pode ainda nao ter dimensoes calculadas pelo layout flex. Alem disso, o container some e reaparece durante o carregamento, o que pode impedir o Leaflet de calcular o tamanho corretamente.

### Solucao

1. **Sempre renderizar o map container div** — em vez de trocar entre spinner e div do mapa, manter o div do mapa SEMPRE no DOM (com `visibility: hidden` enquanto carrega) e colocar o spinner POR CIMA. Assim o Leaflet sempre tem um container com dimensoes reais.

2. **Adicionar `mapReady` state** — a inicializacao do Leaflet so deve acontecer apos confirmar que o container tem dimensoes > 0. Usar um `ResizeObserver` ou simplesmente um `requestAnimationFrame` para garantir.

### Mudancas no `CamMapEditorPage.tsx`

- Linha ~583-594: Mudar a renderizacao condicional do map container para sempre renderizar o div, escondendo visualmente durante loading:

```tsx
{/* Map area */}
<div className="flex-1 relative">
  {/* Map container - ALWAYS in DOM */}
  <div 
    ref={mapContainerRef} 
    className="absolute inset-0" 
    style={{ background: '#1a2420', visibility: assetsLoading ? 'hidden' : 'visible' }} 
  />
  
  {assetsLoading && (
    <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
      <Loader2 ... />
    </div>
  )}
  ...
```

- Linha ~337-369: Ajustar o efeito de init do mapa para usar `requestAnimationFrame` + `invalidateSize` para garantir que o container tem dimensoes:

```tsx
useEffect(() => {
  if (assetsLoading || !mapContainerRef.current || mapRef.current) return;
  
  // Wait a frame for layout to settle
  requestAnimationFrame(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, { ... });
    map.setView([-DEFAULT_CENTER_Y, DEFAULT_CENTER_X], 3);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 200);
    // ... click handler
  });
  
  return () => { ... };
}, [assetsLoading]);
```

Isso resolve o problema porque o container do mapa passa a existir desde o inicio com dimensoes reais do layout flex, permitindo ao Leaflet inicializar corretamente.

