# Plano: Integrar Mapa Próprio

## Status: ✅ Concluído

## O que foi implementado

### 1. Remoção de Referências Externas
- Removido bloco "Fonte: Tibiara" do modal de detalhes
- Removido link "Buscar no Tibiara" do estado de erro
- Links de mapa agora abrem modal interno em vez de site externo

### 2. Sistema de Mapa Interativo
- **16 floors** (0-15) copiados para `public/map/`
- Visualizador usando **Leaflet.js** para navegação interativa
- Suporte a pan, zoom e troca de andares

### 3. Componentes Criados

| Componente | Descrição |
|------------|-----------|
| `MapViewer.tsx` | Visualizador de mapa com Leaflet |
| `MapModal.tsx` | Modal para exibir o mapa |

### 4. Funcionalidades do Mapa
- ✅ Navegação por arrastar (pan)
- ✅ Zoom in/out
- ✅ Troca de andares (floors 0-15)
- ✅ Marcador na posição do NPC
- ✅ Exibição de coordenadas
- ✅ Parse automático de coordenadas do formato `#X,Y,Z:ZOOM`

### 5. Sistema de Coordenadas
- Formato: `#X,Y,Z:ZOOM` (ex: `#32270,32329,7:2`)
- X, Y = posição no mapa
- Z = andar (7 = superfície, <7 = céu, >7 = subterrâneo)
- ZOOM = nível de zoom inicial

---

## Arquivos Modificados/Criados

- `src/components/ItemDetailsModal.tsx` - Integração com MapModal
- `src/components/MapViewer.tsx` - Novo componente de mapa
- `src/components/MapModal.tsx` - Novo modal de mapa
- `public/map/floor-XX-map.png` - 16 imagens de andares
