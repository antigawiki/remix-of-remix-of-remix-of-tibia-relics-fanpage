

## Diagnóstico: extractionParser vs Cam Mapper

Comparei linha por linha o `extractionParser.ts` (este projeto) com o `ProtocolParser.ts` do Cam Mapper (que funciona 100%). A lógica de mapa (getMapDescription, parseFloorDescription, parseFloorChangeUp/Down) é **idêntica**. O problema está nos **opcodes TibiaRelic customizados** que foram adicionados na adaptação.

### O que o Cam Mapper faz diferente

O Cam Mapper **não tem** handlers para: 0xA4, 0xA5, 0xA7, 0xA8, 0xB6, 0x63, 0x9A. Quando encontra qualquer um deles, cai no `default: return` e **para de parsear o frame**. Isso significa que ele perde o restante daquele frame, mas **nunca corrompe dados** — os tiles que já foram lidos estão corretos.

O extractionParser neste projeto tenta parsear esses opcodes, consumindo bytes. Se **qualquer um** deles consumir a quantidade errada de bytes, tudo que vem depois fica desalinhado — incluindo dados de mapa. É assim que tiles aparecem em andares errados ou distorcidos.

### Diferenças específicas encontradas

| Opcode | Cam Mapper | extractionParser (este projeto) | Risco |
|--------|-----------|-------------------------------|-------|
| 0x86 CreatureSquare | u32 + u8 (5 bytes) | u32 + u8 (5 bytes) | OK |
| 0xA4 SpellCooldown | **não existe** → return | u8 + u8 (2 bytes) | Se errado, drift |
| 0xA5 SpellGroupCooldown | **não existe** → return | u8 + u32 (5 bytes) | Se errado, drift |
| 0xA7 PlayerTactics | **não existe** → return | u8 + u8 + u8 (3 bytes) | Se errado, drift |
| 0xA8 CreatureSquare TR | **não existe** → return | u32 + u8 (5 bytes) | Se errado, drift |
| 0xB6 WalkCancel TR | **não existe** → return | u16 (2 bytes) | Se errado, drift |
| 0x63 CreatureTurn | **não existe** → return | u32 + u8 (5 bytes) | Se errado, drift |
| 0x9A FloorChange field | **não existe** → return | 0 bytes | OK (noop) |

Basta **um** desses consumir 1 byte errado para corromper todo o resto do frame. E o Cam Mapper prova que é possível extrair o mapa 100% sem eles.

### Plano de Correção

**Remover os handlers de opcodes TibiaRelic customizados** do extractionParser e alinhar exatamente com o Cam Mapper. Opcodes que o Cam Mapper não trata (0xA4, 0xA5, 0xA7, 0xA8, 0xB6, 0x63, 0x9A) vão cair no `default: return`, parando o parsing do frame sem corromper dados.

Isso troca "perder o final de alguns frames" por "nunca corromper dados" — exatamente a estratégia que faz o Cam Mapper funcionar 100%.

### Arquivo afetado
- `src/lib/tibiaRelic/extractionParser.ts` — remover cases 0xA4, 0xA5, 0xA7, 0xA8, 0xB6, 0x63, 0x9A do switch

