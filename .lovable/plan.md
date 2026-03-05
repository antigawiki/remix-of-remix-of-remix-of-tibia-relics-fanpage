## Scroll/FloorUp/Font Patches — Status: APLICADO ✅

### Correções aplicadas no build-tibiarc.yml

1. **Scroll 18×14**: Os 4 ParseMove (North/East/South/West) agora leem viewport completo 18×14 em vez de 1 row/column, alinhando com o protocolo TibiaRelic
2. **FloorUp z=7**: Loop de 6 floors substituído por leitura de 1 floor (z=5), como o parser JS
3. **Nomes de criaturas half-scale**: Renderiza nomes com `Fonts.Game` em tamanho original num canvas temporário, depois faz downscale 2:1 com averaging de pixels 2x2 para resultado anti-aliased suave
4. **Nomes de monstros ocultos**: `SkipRenderingNonPlayerNames = true` no web_player.cpp

### Arquivos de patch
- `tibiarc-player/name_scale_patch.py` — adiciona função `DrawCreatureNameHalfScale` ao renderer.cpp
- `tibiarc-player/dat_patch.py` — wrapper try-catch para propriedades .dat customizadas

### Próximo passo
Rodar o workflow `Build tibiarc WASM Player` no GitHub Actions para compilar o novo WASM e testar.
