

## Atualizar WASM player com novo build

Você enviou um novo build do tibiarc player (`.wasm` + `.js`). Vou substituir os arquivos atuais em `public/tibiarc/` pelos novos:

### Mudanças

1. **Copiar `tibiarc_player-18.wasm`** → `public/tibiarc/tibiarc_player.wasm`
2. **Copiar `tibiarc_player-16.js`** → `public/tibiarc/tibiarc_player.js`

Nenhuma mudança de código é necessária — o `TibiarcPlayer.tsx` já referencia esses caminhos. O novo WASM será carregado automaticamente.

Antes de prosseguir: esse novo build inclui alguma mudança na API exportada (novas funções, parâmetros diferentes)? Se sim, precisarei adaptar o `TibiarcPlayer.tsx` também. Se é apenas fix interno no C++, basta trocar os arquivos.

