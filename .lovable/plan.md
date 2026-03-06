

## Análise Completa do Fork tibiarc — Bugs Encontrados nos Patches C++

Estudei o código-fonte completo do fork (`antigawiki/tibiarc`) em `lib/parser.cpp` e `lib/versions.cpp`. Para a versão 7.72, as flags do protocolo são:

| Flag | Valor | Motivo |
|------|-------|--------|
| `ReportMessages` | **true** (≥7.70) | Talk já lê u32 messageId |
| `OutfitsU16` | **true** (≥7.70) | Outfits com u16 |
| `OutfitAddons` | **false** (≥7.80) | Sem addons |
| `SpeakerLevel` | **false** (≥7.80) | Sem speakerLevel |
| `Stamina` | **false** (≥7.80) | Sem stamina |
| `PassableCreatures` | **false** (≥8.53) | Sem passable flag |

---

### BUG CRÍTICO #1: 0xAA ParseCreatureSpeak — DOUBLE READ (+4B drift por mensagem)

O fork JÁ lê `u32 messageId` porque `ReportMessages=true` para 7.72. Nosso patch injeta OUTRO `SkipU32()` no início da função. Resultado: **8 bytes lidos em vez de 4**, causando +4B drift em CADA mensagem de chat.

- **TS parser**: lê 1× u32 (statementGuid) ✅  
- **C++ patcheado**: lê 2× u32 (patch + ReportMessages) ❌

**Correção**: Remover o `patch_creature_speak()` do `protocol_patch.py`. O `ReportMessages=true` já consome o u32 que o TibiaRelic envia como statementGuid.

---

### BUG #2: 0xA6 — Patch Desnecessário (já existe no fork)

O fork JÁ tem `case 0xA6: ParseUseCooldown()` que lê `SkipU32()` (4 bytes). Nosso `patch_multi_use_delay()` tenta adicionar outro `case 0xA6`. O check `if re.search(r'case\s+0xA6\s*:', src)` deve pegar isso e pular, mas é um patch inútil.

---

### BUG #3: 0x63 — Patch Inválido (NÃO é opcode top-level)

0x63 no fork é `ParseCreatureCompact` — chamado DENTRO de `ParseObject`, não como opcode top-level. É um ID de criatura no tile data (como 0x61 e 0x62). Adicionar `case 0x63` ao switch principal interceptaria dados que NÃO são creature turn, causando parsing incorreto.

**Correção**: Remover `patch_creature_turn()` do `protocol_patch.py`.

---

### BUG #4: 0xA0 PlayerStats — Patch Desnecessário

`Protocol.Stamina = false` para 7.72 (ativado em ≥7.80). O fork JÁ não lê stamina. O patch é inútil mas inofensivo (o regex não encontra o target e pula).

---

### BUG #5: 0xC8 OutfitDialog — Patch Conflita com Version Flags

O fork usa `OutfitAddons=false` + `OutfitsU16=true` para 7.72, entrando no branch `else if (OutfitsU16) { reader.Skip(4); }` que lê 2×u16 (start+end range). Nosso patch tenta trocar `ReadU16→ReadU8`, mas o fork usa `Skip(4)` — o regex não encontra e pula. Inofensivo.

---

### BUG #6: 0x64 MapDescription Guard — Já No Fork

O fork já tem `if (reader.Remaining() < 100) { return; }` em `ParseFullMapDescription`. Patch redundante.

---

### BUG #7: 0xBE FloorUp — Já No Fork  

O fork já tem o loop de 6 floors em `ParseFloorChangeUp`. Patch redundante.

---

### Resumo das Correções Necessárias

**Arquivo**: `tibiarc-player/protocol_patch.py`

1. **Remover `patch_creature_speak()`** — o fork JÁ lê o u32 via `ReportMessages=true`. Este é o bug mais crítico e causa drift acumulativo em toda mensagem de chat.

2. **Remover `patch_creature_turn()`** — 0x63 não é opcode top-level, é creature ID no tile data.

3. **Remover `patch_player_stats()`** — stamina já não é lida para 7.72.

4. **Remover `patch_map_description_guard()`** — já presente no fork.

5. **Remover `patch_multi_use_delay()`** — `case 0xA6` já existe no fork.

6. **Remover `patch_outfit_window()`** — handled by version flags.

**Manter**: `patch_spell_cooldown`, `patch_spell_group_cooldown`, `patch_player_tactics`, `patch_creature_square`, `patch_walk_cancel`, `patch_creature_impassable`, `patch_diagnostic_logging`.

O **bug #1 (0xAA double read)** é quase certamente a causa principal do desync visual — cada mensagem de chat desloca o buffer em 4 bytes extras, corrompendo todos os opcodes subsequentes no mesmo pacote.

