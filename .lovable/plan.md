## SanitizeCreatureState — Status: APLICADO ✅

### Mudanças aplicadas

| # | Arquivo | Mudança |
|---|---------|---------|
| 1 | `web_player.cpp` | Substituído `DeduplicateCreatures` por `SanitizeCreatureState` com 4 etapas: floor-change cleanup, invalid position purge, floor distance filter (±2), position dedup |
| 2 | `web_player.cpp` | Adicionado tracking de `g_lastPlayerZ` para detectar mudança de andar e purgar criaturas do andar anterior |

### Próximo passo
Rebuild WASM via GitHub Actions e testar com .cam problemáticos.
