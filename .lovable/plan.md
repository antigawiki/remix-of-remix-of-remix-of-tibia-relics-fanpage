

## Adicionar botao de fullscreen ao player

### O que sera feito

Adicionar um botao com icone de fullscreen (Maximize/Minimize do lucide-react) na barra de controles do player. Ao clicar, o container do canvas entra em modo fullscreen usando a Fullscreen API nativa do browser.

### Detalhes tecnicos

**Arquivo: `src/components/TibiarcPlayer.tsx`**

1. Importar `Maximize` e `Minimize` do lucide-react
2. Adicionar state `isFullscreen` (boolean)
3. Criar funcao `toggleFullscreen` que:
   - Usa `containerRef.current.requestFullscreen()` para entrar
   - Usa `document.exitFullscreen()` para sair
4. Adicionar listener de `fullscreenchange` no `useEffect` para sincronizar o state quando o usuario sai do fullscreen via ESC
5. Adicionar o botao na barra de controles (ao lado do botao de mensagens), habilitado apenas quando `hasRecording` e true
6. Adicionar CSS para que em fullscreen o canvas ocupe toda a tela: usar pseudo-classe `:fullscreen` via style ou classe condicional

O container (`containerRef`) ja existe e envolve o canvas -- basta chamar `requestFullscreen()` nele. O canvas ja tem `w-full h-full` entao se adapta automaticamente ao tamanho do container em fullscreen.

### Mudancas

| Arquivo | Mudanca |
|---|---|
| `src/components/TibiarcPlayer.tsx` | Importar icones, adicionar state + handler de fullscreen, listener de evento, botao na UI |

