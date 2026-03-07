## Correção de Byte Drift + Resync Engine — Status: IMPLEMENTADO ✅

### Problema Central
O `packetParser.ts` tinha **6 handlers de opcodes com consumo de bytes incorreto** comparado ao `extractionParser.ts` (que funciona 100%). Isso causava **byte drift** — bytes eram lidos a mais ou a menos, desalinhando todos os opcodes seguintes e gerando 18.654+ DESYNCs falsos.

### Correções aplicadas

| # | Opcode | Antes (errado) | Depois (correto) | Impacto |
|---|--------|----------------|-------------------|---------|
| 1 | 0x96 TextWindow | 1 string (skip16) | 2 strings (str16 + str16) | Faltava 1 string inteira |
| 2 | 0xAE RuleViolChannel | 0 bytes | u16 (2 bytes) | -2 bytes drift |
| 3 | 0xAF RemoveReport | 0 bytes | string (str16) | Faltava string inteira |
| 4 | 0xB0 RuleViolCancel | skip(2) fixo | string (str16) | Bytes variáveis vs fixos |
| 5 | 0xAA Talk type 6 | não tratado | u16 channel | -2 bytes drift |
| 6 | 0x9A PlayerPos | pos3 (5 bytes) | 0 bytes | +5 bytes drift removido |

### Resync Engine (safety net)
Quando um opcode desconhecido ou erro de parse ocorre:
1. Escaneia até 256 bytes à frente procurando opcodes conhecidos
2. Para cada candidato, faz dry-run de 2 opcodes consecutivos
3. Se ambos parseiam sem erro, resincroniza nessa posição
4. Se nenhum candidato funcionar, descarta o resto do frame (fallback anterior)

### isKnownOpcode expandido
Agora inclui todos os opcodes mapeados: 0x14, 0x28, 0x7a-0x7f, 0x87, 0xa5, 0xa6, 0xc8, 0xd2-0xd4, 0xdc, 0xdd, 0xf0, 0xf1.

### Arquivos alterados
- `src/lib/tibiaRelic/packetParser.ts` — 6 fixes + resync engine + isKnownOpcode
- `tibiarc-player/protocol_patch.py` — patches para 0xAE, 0xAF, 0xB0, talk type 6
- `.github/workflows/build-tibiarc.yml` — verificação dos novos patches

### Próximo passo
1. Testar com arquivo .cam no Protocol Lab para confirmar redução de DESYNCs
2. Disparar workflow `Build tibiarc WASM Player` para rebuildar com patches C++
