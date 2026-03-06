## Scroll/FloorUp/Font Patches — Status: APLICADO ✅

### Correções aplicadas no build-tibiarc.yml

1. **Scroll 18×14**: Os 4 ParseMove (North/East/South/West) agora leem viewport completo 18×14 em vez de 1 row/column, alinhando com o protocolo TibiaRelic
2. **FloorUp z=7**: Loop de 6 floors substituído por leitura de 1 floor (z=5), como o parser JS
3. **Fonte menor**: Nomes de criaturas usam `InterfaceSmall` em vez de `Game` font
4. **Nomes de monstros ocultos**: `SkipRenderingNonPlayerNames = true` no web_player.cpp

### Próximo passo
Rodar o workflow `Build tibiarc WASM Player` no GitHub Actions para compilar o novo WASM e testar.
