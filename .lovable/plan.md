## Auditoria Completa — Status: PATCHES CORRIGIDOS ✅

### Bug crítico encontrado e corrigido

**0xAA ParseCreatureSpeak — DOUBLE READ removido**: O fork já lê `u32 messageId` via `ReportMessages=true` para 7.72. O patch antigo injetava outro `SkipU32()`, causando **+4B drift por mensagem de chat** — a causa principal do desync visual.

### Patches válidos mantidos (7)

| # | Opcode/Área | Descrição |
|---|--------|-----------|
| 1 | `0xA4` | SpellCooldown 5B→2B |
| 2 | `0xA5` | SpellGroupCooldown 5B (separado do 0xA4) |
| 3 | `0xA7` | PlayerTactics 4B→3B (sem PvPMode) |
| 4 | `0xA8` | CreatureSquare (novo case, 5B) |
| 5 | `0xB6` | WalkCancel 2B→0B |
| 6 | `0x92` | CreatureImpassable assert removido |
| 7 | — | Diagnostic opcode logging |

### Patches removidos (6) — redundantes ou incorretos

| # | Patch | Motivo da remoção |
|---|-------|-------------------|
| 1 | **0xAA ParseCreatureSpeak** | `ReportMessages=true` já lê u32 — patch causava **double read** |
| 2 | **0x63 CreatureTurn** | Não é opcode top-level, é creature ID no tile data |
| 3 | **0xA0 PlayerStats** | `Stamina=false` para 7.72, fork já não lê |
| 4 | **0x64 MapDescription guard** | Já presente no fork |
| 5 | **0xA6 MultiUseDelay** | `case 0xA6` já existe no fork |
| 6 | **0xC8 OutfitWindow** | Handled by `OutfitsU16` version flag |

### Próximo passo

Executar o workflow `Build tibiarc WASM Player` no GitHub Actions para rebuildar o WASM sem o double-read bug.
