

## Atualizar WASM Player para v10

### Mudanças

**1. Copiar arquivos WASM v10**
- `user-uploads://tibiarc_player-10.js` -> `public/tibiarc/tibiarc_player.js`
- `user-uploads://tibiarc_player-10.wasm` -> `public/tibiarc/tibiarc_player.wasm`

Isso ativa a funcao `set_overlay` no WASM, permitindo que o botao de toggle de overlay no player funcione corretamente.

