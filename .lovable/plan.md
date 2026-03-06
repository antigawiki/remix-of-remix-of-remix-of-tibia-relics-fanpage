

## Diagnóstico Profundo: Por que os tiles "brigam" no WASM Player

Comparei linha a linha o parser do projeto de referência (Relic Cam Player) com o parser deste projeto e o pipeline C++ do WASM. Encontrei **múltiplos bugs de contagem de bytes** que causam perda massiva de frames.

---

### Causa Raiz: Opcode 0x63 (CreatureTurn) não tratado no C++ WASM

O `protocol_patch.py` explicitamente diz *"0x63 CreatureTurn: not a top-level opcode"* — **isso está ERRADO**. O servidor TibiaRelic envia 0x63 como opcode standalone toda vez que uma criatura vira. A cada ocorrência, o parser C++ lança exceção e **o frame INTEIRO é perdido** (incluindo tile updates, creature moves, etc. que estavam no mesmo frame).

Diferença crítica entre JS e WASM:
- **JS (referência)**: Aplica cada opcode diretamente no GameState. Se 0x63 falha, os opcodes anteriores já foram aplicados.
- **WASM (tibiarc)**: Acumula eventos em um vetor. Se 0x63 falha, o vetor é destruído e TODOS os eventos do frame são perdidos.

Criaturas viram constantemente (ataque, movimento, idle). Isso causa **perda constante de frames**, resultando nos tiles "brigando" — tile updates sendo aleatoriamente descartados.

---

### Bugs no JS Parser (ferramentas de debug)

Comparação com o parser de referência revelou 5 bugs adicionais:

| Opcode | Bug | Impacto |
|--------|-----|---------|
| **0x0B** (GM Actions) | Lê 0 bytes, deveria ler **32 bytes** | Corrompe frame do login |
| **0xAA** talk tipo 17 (MonsterYell) | Falta ler posição (5 bytes) | -5B drift por grito de monstro |
| **0xAA** talk tipo 14 (ChannelAnonymousRed) | Lê pos(5B) em vez de u16(2B) channel | +3B drift |
| **0xAA** talk tipo 6 (RuleViolation) | Lê u32 extra desnecessário | +4B drift |
| **0x7B** (NPC Vendor Goods) | Lê u16+u16 por item, deveria ser u16+**u8** | +1B por item |

O bug do MonsterYell (tipo 17) é especialmente grave: em áreas com monstros, cada grito causa perda do resto do frame.

---

### Plano de Correção (3 arquivos)

**1. `tibiarc-player/protocol_patch.py`** — Adicionar handler para 0x63:
- Nova função `patch_creature_turn()` que adiciona `case 0x63: reader.Skip(5); break;` antes do case 0x64 no switch principal
- Isso evita que o parser C++ lance exceção em CreatureTurn

**2. `src/lib/tibiaRelic/packetParser.ts`** — Corrigir 5 bugs do JS parser:
- 0x0B: mudar de `{}` para `r.skip(32)`
- Talk: `POS_TYPES = {0x01, 0x02, 0x03, 0x10, 0x11}` (adicionar 0x11, remover 0x0E)
- Talk: `CHAN_TYPES = {0x05, 0x0A, 0x0C, 0x0E}` (adicionar 0x0E)
- Talk: Remover `TIME_TYPES` e tipo 6 (RuleViolation lê apenas string)
- 0x7B: mudar segundo `r.u16()` para `r.u8()`

**3. `.github/workflows/build-tibiarc.yml`** — Atualizar verificação:
- Remover grep por "WalkCancel 0 bytes" (patch foi revertido intencionalmente)
- Adicionar grep para verificar presença de `case 0x63`

**4. Rebuild WASM** — Após merge, disparar o workflow para gerar novo .wasm com o fix do 0x63

