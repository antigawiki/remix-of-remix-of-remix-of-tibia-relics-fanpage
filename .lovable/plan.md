
# Fix: Criaturas mostrando sprites errados (borboletas) e andares com problemas

## Causa Raiz Identificada

O problema principal esta na funcao `readOutfit` e `skipOutfit` no packetParser.ts. O codigo atual le o **looktype** (ID do outfit) como `u16` (2 bytes), mas no protocolo Tibia 7.x (incluindo 7.72), o looktype e **u8** (1 byte).

### Por que isso causa "borboletas"

Quando o parser le u16 em vez de u8, ele consome 1 byte extra. Exemplo:
- Dados reais: `[0x80, 0x4E, 0x28, 0x1C, 0x0A, ...]` (looktype=128, head=78, body=40, legs=28, feet=10)
- Leitura u16 LE: looktype = 0x4E80 = 20096 (outfit inexistente ou sprite totalmente errado)
- Os 4 bytes seguintes (head/body/legs/feet) tambem ficam deslocados

Quando o looktype byte e seguido de head=0 (ex: `[0x80, 0x00, ...]`), u16 LE = 128, que funciona por coincidencia. Isso explica por que **algumas** criaturas aparecem corretas e outras como borboletas.

Cada criatura lida com erro desloca 1 byte extra, acumulando dessincronia no stream e corrompendo dados subsequentes (tiles, andares, etc).

## Correcoes Planejadas

### 1. Corrigir leitura de outfit no packetParser.ts

**`readOutfit`**: Mudar `r.u16()` para `r.u8()` no looktype:
```text
Antes: const oid = r.u16();
Depois: const oid = r.u8();
```

**`skipOutfit`**: Mesma correcao:
```text
Antes: const oid = r.u16();
Depois: const oid = r.u8();
```

Se looktype == 0, le u16 para item-as-outfit (isso permanece igual).
Se looktype != 0, le 4 bytes de cores (head, body, legs, feet) - tambem permanece igual.

### 2. Corrigir skipOutfitWindow (opcode 0xC8)

No protocolo 7.x, o dialogo de outfit usa u8 para os limites de range (nao u16):
```text
Antes: this.skipOutfit(r); r.u16(); r.u16();
Depois: this.skipOutfit(r); r.u8(); r.u8();
```

### 3. Adicionar log de diagnostico para primeiro outfit

Adicionar um log ao ler o primeiro outfit para validar que os valores agora sao corretos (outfit IDs tipicos para players em 7.4 sao 128-136).

## Resumo Tecnico

| Arquivo | Funcao | Mudanca |
|---------|--------|---------|
| packetParser.ts | `readOutfit` | looktype: u16 -> u8 |
| packetParser.ts | `skipOutfit` | looktype: u16 -> u8 |
| packetParser.ts | `skipOutfitWindow` | range start/end: u16 -> u8 |

Essas 3 mudancas resolvem a raiz do problema de criaturas com sprites errados e devem tambem melhorar a estabilidade geral do parsing (menos dessincronia de bytes).
