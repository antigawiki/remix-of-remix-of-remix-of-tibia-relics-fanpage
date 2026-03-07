## Recovery Per-Opcode no Parser C++ — Status: IMPLEMENTADO ✅

### Problema Central
`Parser::Parse()` do tibiarc acumula eventos num vetor. Se qualquer opcode no frame lança exceção, o `catch` em `web_player.cpp` descarta **todos** os eventos do frame.

### Correções aplicadas

| # | Arquivo | Correção |
|---|---------|----------|
| 1 | `protocol_patch.py` | **`patch_parse_loop_recovery()`** — envolve switch em try-catch per-iteração, preserva eventos já parseados |
| 2 | `protocol_patch.py` | **`patch_remove_diagnostic_logging()`** — remove printf("[DIAG]") que matava performance |
| 3 | `protocol_patch.py` | **default case** — muda de `throw` para `break` (opcode desconhecido não destrói eventos) |
| 4 | `build-tibiarc.yml` | Verificação atualizada: grep para recovery, catch block, default break; removido grep do diagnostic |

### Patches de protocolo ativos (protocol_patch.py)
- 0xA4 SpellCooldown (2B)
- 0xA5 SpellGroupCooldown (5B)
- 0xA7 PlayerTactics (3B, sem PvPMode)
- 0xA8 CreatureSquare (5B)
- 0xB6 WalkCancel (standard ParseMoveDelay 2B)
- 0x92 CreatureImpassable (assert removido)
- 0x63 CreatureTurn (5B)
- **Parse loop recovery** (try-catch per-opcode)
- **Diagnostic logging removido**

### Próximo passo
Disparar o workflow `Build tibiarc WASM Player` no GitHub Actions para rebuildar o WASM com o recovery per-opcode.
