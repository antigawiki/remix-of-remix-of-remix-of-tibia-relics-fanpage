## Auditoria Completa — Status: PATCHES APLICADOS ✅

Todos os patches identificados na auditoria foram adicionados ao workflow `.github/workflows/build-tibiarc.yml`.

### Patches aplicados (total: 20)

| # | Opcode | Descrição | Status |
|---|--------|-----------|--------|
| 1 | `0xA4` | SpellCooldown 5B→2B | ✅ já existia |
| 2 | `0xA7` | PlayerTactics 4B→3B | ✅ já existia |
| 3 | `0xA8` | CreatureSquare (novo case) | ✅ já existia |
| 4 | `0xB6` | WalkCancel 2B→0B | ✅ já existia |
| 5 | `0x92` | CreatureImpassable assert removido | ✅ já existia |
| 6-9 | `0x65-0x68` | Scrolls revertidos para padrão | ✅ já existia |
| 10 | `0xBE` | FloorUp z=7 revertido (6 floors) | ✅ já existia |
| **11** | **`0xAA`** | **Talk +u32 statementGuid** | ✅ **NOVO** |
| **12** | **`0x64`** | **Mini MapDesc guard (<100B)** | ✅ **NOVO** |
| **13** | **`0xA0`** | **PlayerStats sem stamina** | ✅ **NOVO** |
| **14** | **`0xA5`** | **SpellGroupCooldown 5B** | ✅ **NOVO** |
| **15** | **`0xA6`** | **MultiUseDelay 4B** | ✅ **NOVO** |
| **16** | **`0x63`** | **CreatureTurn 5B** | ✅ **NOVO** |
| **17** | **`0xC8`** | **OutfitWindow u16→u8 range** | ✅ **NOVO** |

### Próximo passo

Executar o workflow `Build tibiarc WASM Player` no GitHub Actions para rebuildar o WASM com todos os patches e testar a reprodução de .cam files.
