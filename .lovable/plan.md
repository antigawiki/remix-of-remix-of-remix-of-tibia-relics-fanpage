

## O problema está no WASM (C++) — patches faltando no `protocol_patch.py`

Você tem razão. O parser TypeScript tem 0 erros, mas o motor WASM C++ está dessincronizando porque **6 patches críticos documentados no `fix-scroll-floor-range.patch` nunca foram implementados no `protocol_patch.py`**.

### Patches que o C++ TEM (8):
| # | Patch | Status |
|---|-------|--------|
| 1 | 0xAA Talk +u32 statementGuid | ✅ |
| 2 | 0xA4 SpellCooldown 5B→2B | ✅ |
| 3 | 0xA5 SpellGroupCooldown 5B | ✅ |
| 4 | 0xA7 PlayerTactics 4B→3B | ✅ |
| 5 | 0xA8 CreatureSquare 5B | ✅ |
| 6 | 0xB6 WalkCancel 0B | ✅ |
| 7 | 0x92 CreatureImpassable assert | ✅ |
| 8 | Diagnostic logging | ✅ |

### Patches que FALTAM no C++ (6):
| # | Patch | Impacto |
|---|-------|---------|
| 1 | **0xA0 PlayerStats sem stamina** (remover `ReadU16` stamina) | **+2B drift a cada PlayerStats** → desync acumulativo |
| 2 | **0x64 MapDescription guard** (< 100B = position-only) | Crash/drift em mini map desc |
| 3 | **0xA6 MultiUseDelay** (novo case, 4B) | **+4B drift** a cada multi-use |
| 4 | **0x63 CreatureTurn** (novo case, 5B) | **+5B drift** a cada creature turn |
| 5 | **0xC8 OutfitWindow u16→u8** (RangeStart/RangeEnd) | **+2B drift** a cada outfit window |
| 6 | **0xBE FloorUp z=7** (ler 6 floors) | **Drift massivo** em transição subsolo→superfície |

Cada patch faltando causa byte drift no C++, que se acumula ao longo da gravação. Isso explica os tiles pretos, player desaparecendo, e erros que aparecem progressivamente.

### Plano de correção

**Arquivo 1**: `tibiarc-player/protocol_patch.py` — adicionar 5 novas funções de patch:

1. `patch_player_stats()` — encontrar `ParsePlayerStats`, remover a linha `Stamina_ = reader.ReadU16()`
2. `patch_map_description_guard()` — encontrar `ParseMapDescription`, injetar early return quando `reader.Remaining() < 100`
3. `patch_multi_use_delay()` — adicionar `case 0xA6: reader.SkipU32(); break;` no switch principal
4. `patch_creature_turn()` — adicionar `case 0x63: reader.Skip(5); break;` no switch principal
5. `patch_outfit_window()` — encontrar `ParseOutfitWindow`, trocar `ReadU16` por `ReadU8` em RangeStart/RangeEnd

**Arquivo 2**: `.github/workflows/build-tibiarc.yml` — adicionar chamada ao `floorup_patch.py`:
```
python3 $GITHUB_WORKSPACE/tibiarc-player/floorup_patch.py lib/parser.cpp
```

Nenhuma alteração no TypeScript — o problema é exclusivamente no motor C++.

