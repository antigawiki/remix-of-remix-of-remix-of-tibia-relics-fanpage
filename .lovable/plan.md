

## Auditoria Completa: tibiarc C++ parser vs TibiaRelic (referência JS)

O parser JS (`packetParser.ts`) funciona corretamente com o protocolo TibiaRelic. O parser C++ (`lib/parser.cpp` do tibiarc) foi projetado para o protocolo 7.72 padrão. Abaixo estão **todas as divergências** identificadas, divididas entre as já corrigidas via sed no workflow e as que **ainda faltam corrigir**.

---

### Divergências já corrigidas (via sed no workflow)

| # | Opcode | Descrição | tibiarc padrão | TibiaRelic (JS) | Patch aplicado |
|---|--------|-----------|---------------|-----------------|----------------|
| 1 | `0xA4` | SpellCooldown | u8 spellId + u32 delay (5B) | u8 + u8 (2B) | `SkipU32()` → `SkipU8()` |
| 2 | `0xA7` | PlayerTactics | 4×u8 (fight+chase+safe+pvp) | 3×u8 (sem pvpMode) | Linha do PvPMode removida |
| 3 | `0xA8` | CreatureSquare | Não existe no tibiarc | u32 creatureId + u8 color (5B) | Case adicionado com `Skip(5)` |
| 4 | `0xB6` | WalkCancel | u16 via ParseMoveDelay (2B) | 0 bytes | ParseMoveDelay substituído por no-op |
| 5 | `0x92` | CreatureImpassable | Assert + skip | Sem assert (opcode válido em 7.72) | Assert removido |
| 6 | `0x65-0x68` | Scrolls | Fork lia 18×14 (full viewport) | Padrão: 1×14 ou 18×1 | Revertido para padrão |
| 7 | `0xBE` | FloorUp z=7 | Fork lia 1 floor | Padrão: 6 floors (5→0) | Revertido para 6 floors |

---

### Divergências NÃO corrigidas (precisam de novos patches)

| # | Opcode | Descrição | tibiarc C++ (provável) | TibiaRelic JS (correto) | Impacto do drift |
|---|--------|-----------|----------------------|------------------------|-----------------|
| **8** | `0x0a` | Login/SelfAppear | Varia por versão — tibiarc lê campos extras (canReportBugs, etc.) | `u32 playerId + u16 beatDuration + u8 canReportBugs` (7B) | Se o C++ ler mais bytes aqui, TODO o resto da sessão desalinha |
| **9** | `0xAA` | Talk/Chat | tibiarc 7.72 padrão: `str16 name + u8 type + pos/channel + str16 msg` | TibiaRelic adiciona `u32 statementGuid` ANTES do nome | **+4 bytes** em CADA mensagem de chat — drift acumulativo grave |
| **10** | `0xA0` | PlayerStats | tibiarc lê ~22+ bytes (HP, maxHP, cap, XP, level, mana, maxMana, magLvl, etc.) com stamina | TibiaRelic: `skip(20)` — 20 bytes sem stamina | Diferença de 2+ bytes se tibiarc lê stamina |
| **11** | `0xA1` | PlayerSkills | tibiarc lê 7 skills × (u8 level + u8 percent) = 14B ou mais com loyalty | JS: `skip(14)` — 14 bytes fixos | OK se tibiarc também lê 14, mas se incluir loyalty/stamina → drift |
| **12** | `0xA5` | SpellGroupCooldown | Pode não existir no tibiarc 7.72 | `u8 groupId + u32 delay` (5B) | Se opcode desconhecido no C++ → crash ou drift |
| **13** | `0xA6` | MultiUseDelay | Pode não existir no tibiarc 7.72 | `u32` (4B) | Mesmo risco que 0xA5 |
| **14** | `0x6E` | OpenContainer | Formato pode variar | JS: `u8 + u16 + str16 + u8 + u8 + u8×(items)` | Discrepância no str16 vs u16 do container name |
| **15** | `0x64` | MapDescription | tibiarc sempre lê full multi-floor | JS: guard `if (r.left() < 100)` → mini MAP_DESC (position-only, ~5B) | **Crítico**: TibiaRelic envia 0x64 periódicos com apenas coordenadas. C++ tenta ler tiles e consome opcodes como tile data → **corrupção total** |
| **16** | `0xC8` | OutfitWindow | tibiarc lê com range u16 (post-7.x) | JS: `u8 + u8` para range (7.72 style) | Se C++ lê u16+u16 em vez de u8+u8 → +2B drift |
| **17** | `0x96` | TextWindow | Formato varia por versão | JS: `u32 + u16 + u16 + str16` | Precisa verificar se C++ lê o mesmo |
| **18** | `0x7A` | NPC Trade | Formato pode incluir campos extras | JS: `u8 count × (u16 + u8 + str16 + u32 + u32)` | Se C++ tem formato diferente → drift em qualquer interação com NPC |
| **19** | Scroll flood range | getFloorRange para scrolls | tibiarc: depende da versão | JS: surface z≤7 lê floors 7→0; underground lê z±2 | Se C++ usa range diferente ao ler tiles em scrolls → bytes consumidos a mais/menos |
| **20** | `0x63` | CreatureTurn (top-level) | tibiarc pode não ter este como opcode standalone | JS: `u32 creatureId + u8 direction` (5B) | Se não reconhecido → drift |

---

### Os 3 bugs mais críticos (prioridade máxima)

**1. Opcode `0xAA` (Talk) — Statement GUID (+4 bytes)**
O TibiaRelic envia um `u32 statementGuid` extra no início de cada mensagem de chat que o protocolo padrão 7.72 não tem. Como chat acontece constantemente, cada mensagem causa +4B de drift. Este é provavelmente o **maior causador** de desync durante playback.

**2. Opcode `0x64` (MapDescription) — Mini MAP_DESC**
O TibiaRelic envia periodicamente um 0x64 com apenas 5 bytes de coordenadas (sem tile data). O C++ tenta ler um full multi-floor map e consome centenas de bytes de opcodes subsequentes como se fossem tiles. Isso causa **corrupção catastrófica** — explicaria o "personagem sumindo" e tela preta.

**3. Opcode `0xA0` (PlayerStats) — Stamina**
Se o C++ lê stamina (2B extras) que o TibiaRelic não envia, cada atualização de stats (frequente) causa drift.

---

### Plano de correção

Todos os fixes seriam patches `sed` adicionais no arquivo `.github/workflows/build-tibiarc.yml`:

1. **0xAA Talk**: Injetar `reader.SkipU32()` no início de `ParseTalk` para consumir o statementGuid
2. **0x64 Mini MapDesc**: Adicionar guard de tamanho — se `reader.Remaining() < 100` após ler as coordenadas, skip tile reading
3. **0xA0 Stats**: Verificar e ajustar o número exato de bytes lidos (provavelmente remover leitura de stamina)
4. **0xA5/0xA6**: Adicionar cases no switch se não existirem
5. **0xC8 OutfitWindow**: Forçar range u8×2 em vez de u16×2
6. **0x63 CreatureTurn**: Verificar se existe como case no switch principal

Após estes fixes, um rebuild do WASM deveria resolver a maioria dos problemas de desync, personagem desaparecendo e tela preta.

