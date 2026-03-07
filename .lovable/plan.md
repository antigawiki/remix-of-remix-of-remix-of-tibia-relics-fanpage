## Correções de Protocolo — Status: IMPLEMENTADO ✅

### Correções aplicadas nesta iteração

| # | Arquivo | Correção |
|---|---------|----------|
| 1 | `protocol_patch.py` | **0x63 CreatureTurn** — novo case top-level (5B: u32 cid + u8 dir) |
| 2 | `packetParser.ts` | **0x0B GM Actions** — skip 32 bytes (era 0) |
| 3 | `packetParser.ts` | **0xAA Talk tipo 0x11** (MonsterYell) — adicionado a POS_TYPES (lê 5B posição) |
| 4 | `packetParser.ts` | **0xAA Talk tipo 0x0E** (ChannelAnonymousRed) — movido para CHAN_TYPES (lê u16 channel) |
| 5 | `packetParser.ts` | **0xAA Talk tipo 0x06** (RuleViolation) — removido TIME_TYPES (sem u32 extra) |
| 6 | `packetParser.ts` | **0x7B NPC Trade Ack** — u16+u8 por item (era u16+u16) |
| 7 | `build-tibiarc.yml` | Verificação atualizada: grep para 0x63, removido grep WalkCancel 0 bytes |

### Próximo passo

Disparar o workflow `Build tibiarc WASM Player` no GitHub Actions para rebuildar o WASM com o fix do 0x63 CreatureTurn.
