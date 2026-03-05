## Scroll/FloorUp Revert Patches — Status: REMOVIDO ✅

### Correção
Removidos os patches `sed` que revertiam as dimensões de scroll (18×14 → 1×14/18×1) e FloorUp (1 floor → 6 floors). O fork `antigawiki/tibiarc` já lê 18×14 porque o TibiaRelic envia viewport completo — os reverts causavam byte drift massivo em cada passo do jogador.

### Próximo passo
Rodar o workflow `Build tibiarc WASM Player` no GitHub Actions para compilar o novo WASM e testar.
