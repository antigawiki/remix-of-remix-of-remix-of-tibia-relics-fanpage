## Limpeza de Patches Corruptivos — Status: APLICADO ✅

Removidos 5 patches que estavam causando corrupção generalizada de sprites e tiles:

| # | Patch removido | Motivo |
|---|---------------|--------|
| 1 | `dat_patch.py` (Two-phase DAT) | Scan por 0xFF corrompia database de itens |
| 2 | OutfitWindow `ReadU16→ReadU8` global | Mudava LookType (u16 legítimo), causando drift de 1 byte |
| 3 | FloorDown (0xBF) range patch | Leitura parcial de andares |
| 4 | Stuck-buffer detection | Abortava loops válidos de tiles |
| 5 | Diagnostic opcode logging | Sed global matchava múltiplos switches |

### Patches mantidos (corretos)
- 0xA4, 0xA7, 0xA8, 0xB6, 0xAA, 0x64, 0xA0, 0xA5, 0xA6, 0x63, 0x92
- OutfitWindow com sed targetado (só RangeStart/RangeEnd)
- Scroll reverts (0x65-0x68) e FloorUp (0xBE)
- Position_ public + save/restore em web_player.cpp

### Próximo passo
Executar workflow no GitHub Actions e atualizar o WASM.
