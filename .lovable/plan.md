## Auditoria Completa — Status: SCROLL PATCH APLICADO ✅

### Scroll Patch (NOVO — fix para black squares e desync)

| Arquivo | Descrição | Status |
|---------|-----------|--------|
| `tibiarc-player/scroll_patch.py` | Patch Python que altera ParseMoveNorth/East/South/West para ler viewport 18x14 completo (TibiaRelic envia viewport inteiro em cada scroll) | ✅ Criado |
| `.github/workflows/build-tibiarc.yml` | Integrado scroll_patch.py na pipeline de build | ✅ Atualizado |
| `protocolDissector.ts` | Corrigido getAnomalies() para ignorar cam changes de opcodes esperados | ✅ Corrigido |
| `PacketDissector.tsx` | Filtro de anomalias e styling atualizado para não marcar scrolls normais | ✅ Corrigido |

### Próximo passo

Executar o workflow `Build tibiarc WASM Player` no GitHub Actions para rebuildar o WASM com o scroll patch.

### Patches anteriores (total: 21)

| # | Opcode/Área | Descrição | Status |
|---|--------|-----------|--------|
| 1 | `0xA4` | SpellCooldown 5B→2B | ✅ já existia |
| 2 | `0xA7` | PlayerTactics 4B→3B | ✅ já existia |
| 3 | `0xA8` | CreatureSquare (novo case) | ✅ já existia |
| 4 | `0xB6` | WalkCancel 2B→0B | ✅ já existia |
| 5 | `0x92` | CreatureImpassable assert removido | ✅ já existia |
| 6-9 | `0x65-0x68` | Scrolls revertidos para padrão | ✅ já existia |
| 10 | `0xBE` | FloorUp z=7 revertido (6 floors) | ✅ já existia |
| 11 | `0xAA` | Talk +u32 statementGuid | ✅ existente |
| 12 | `0x64` | Mini MapDesc guard (<100B) | ✅ existente |
| 13 | `0xA0` | PlayerStats sem stamina | ✅ existente |
| 14 | `0xA5` | SpellGroupCooldown 5B | ✅ existente |
| 15 | `0xA6` | MultiUseDelay 4B | ✅ existente |
| 16 | `0x63` | CreatureTurn 5B | ✅ existente |
| 17 | `0xC8` | OutfitWindow u16→u8 range | ✅ existente |
| **18** | **DAT parser** | **Resiliência a flags desconhecidas (0x50, 0xC8, 0xD0)** | ✅ **NOVO** |

### SPR Loader C++
Análise do código-fonte confirmou que o SPR loader já tem try-catch para `InvalidDataError` (sprites.cpp:266-273 e 326-337). Sprites corrompidos ou vazios são tratados graciosamente retornando sprite nulo. **Nenhum patch necessário.**
