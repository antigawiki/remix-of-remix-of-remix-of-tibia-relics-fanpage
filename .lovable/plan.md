## Status: Aplicado ✅

As mudanças no `web_player.cpp` foram feitas:

1. `g_skip_messages` agora inicia como `true` (mensagens ocultas por default)
2. `RenderFrame` usa flags adicionais: `SkipRenderingPlayerNames`, `SkipRenderingStatusBars` (mantém creature names, health bars e icons visíveis)
3. Título da janela SDL mudado para "Tibia Relic - Cam Player"

### Próximo passo
Rodar o workflow **"Build tibiarc WASM Player"** no GitHub Actions para recompilar o WASM com estas mudanças.
