## Correção: Position_ Save/Restore + MapDesc Guard — Status: APLICADO ✅

### Mudanças aplicadas

| # | Arquivo | Mudança |
|---|---------|---------|
| 1 | `web_player.cpp` | Removido save/restore de `Position_` — parser mantém estado natural após exceção |
| 2 | `dat_patch.py` | Trocado scan-0xFF por `return` simples no catch |
| 3 | `build-tibiarc.yml` | Removido MapDesc guard (`< 100 bytes`), re-adicionado dat_patch.py seguro |

### Próximo passo
Executar workflow no GitHub Actions e atualizar os arquivos WASM.
