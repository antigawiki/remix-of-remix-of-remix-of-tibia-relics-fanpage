

## Diagnóstico dos dois bugs

### Bug 1: "Mensagens aparecendo na tela" ao avançar

O problema está no `TibiarcPlayer`: a variável `overlayEnabled` começa como `true` (linha 108), mas a função `set_skip_messages` do WASM **nunca é chamada na carga inicial**. O WASM também começa com `g_skip_messages = false`, então as mensagens de chat do jogo são renderizadas por padrão.

Além disso, cada `reloadRecording` (feito no seek) **reseta o estado interno do WASM**, incluindo `g_skip_messages`, mas o JS nunca re-aplica o valor atual de `overlayEnabled` após o reload.

**Fix:** Após cada chamada a `load_recording_tibiarelic` (tanto no load inicial quanto no `reloadRecording`), chamar `set_skip_messages` com o valor atual de `overlayEnabled`. Também inverter o default para `false` (mensagens escondidas por padrão).

### Bug 2: Título "tibiarc" aparecendo na janela

O SDL_CreateWindow do C++ (`SDL_CreateWindow("tibiarc", ...)`) faz o Emscripten setar `document.title = "tibiarc"` durante a inicialização do módulo WASM. O `setInterval` de 500ms no CamPlayerPage tenta corrigir, mas há um flash visível.

**Fix:** Usar `MutationObserver` no elemento `<title>` para interceptar e reverter **instantaneamente** qualquer mudança para "tibiarc", eliminando o flash. Remover o `setInterval`.

### Mudanças

1. **`src/components/TibiarcPlayer.tsx`**:
   - Mudar `overlayEnabled` default para `false`
   - Converter `overlayEnabled` em ref para acesso dentro de callbacks
   - Após cada `load_recording_tibiarelic` (no `handleFileSelect` e no `reloadRecording`), chamar `set_skip_messages` com o valor atual

2. **`src/pages/CamPlayerPage.tsx`**:
   - Substituir `setInterval` por `MutationObserver` no `<title>` para correção instantânea do título

