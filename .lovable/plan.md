

## Bug encontrado: `addThing` (0x6a) nao trata CR_OLD (0x63)

### Evidencia direta

Debug log linha 17:
```
FRAME_END opcodes="ADD_THING, 0x63, 0x1" bytesLeft=0
```

Isso mostra que apos `addThing` ser processado, o byte 0x63 (que era parte dos dados de criatura CR_OLD dentro do addThing) foi lido como um opcode separado. Depois, o proximo byte (0x01 = direcao da criatura) tambem foi lido como opcode. Ambos consumiram bytes errados.

### O que acontece (raiz do problema)

No C++ (`ParseTileAddObject` linha 463-475), o opcode `0x6a` (addThing) chama `ParseObject`, que trata TODOS os 3 tipos de criatura:
- 0x61 (CR_FULL): u32 removeId + u32 cid + string name + outfit + ...
- 0x62 (CR_KNOWN): u32 cid + health + dir + outfit + ...
- **0x63 (CR_OLD): u32 cid + u8 direction** (5 bytes apos o marker)

No nosso JS `addThing`, so tratamos CR_FULL e CR_KNOWN. A condicao para items e `word >= 100`, e CR_OLD = 0x0063 = 99, que e MENOR que 100. Entao addThing retorna sem consumir NADA alem do pos3.

O resultado: 7 bytes de dados de criatura (2 marker + 4 cid + 1 dir) ficam no buffer. O `processDirectOpcodes` interpreta 0x63 como opcode "creature turn", consumindo 6 bytes errados. Sobra 1 byte de drift.

### Por que so no cave

Fora do cave: poucos monstros, `addThing` recebe principalmente CR_FULL (monstro novo) ou items. CR_OLD no addThing e raro.

Dentro do cave: muitos monstros ja conhecidos entrando/saindo de tiles. O servidor envia `addThing` com CR_OLD (criatura ja vista, so precisa ID + direcao). Cada ocorrencia gera 1 byte de drift. Apos poucas dezenas, o parser esta completamente dessincronizado.

### Correcao

**Arquivo: `packetParser.ts` — metodo `addThing()`** (linhas 584-601):

Adicionar tratamento para CR_OLD entre CR_KNOWN e a condicao de items:

```text
} else if (word === CR_OLD) {
    r.skip(2);  // consume marker
    const cid = r.u32();
    const dir = r.u8();
    const c = this.gs.creatures.get(cid);
    if (c) {
        this.removeCreatureFromTile(cid, c.x, c.y, c.z);
        c.direction = dir;
    }
    this.placeCreatureOnTile(c || createCreature(), x, y, z);
```

**Arquivo: `packetParser.ts` — metodo `addThing()`**:

Tambem corrigir a condicao de items de `word >= 100 && word <= 9999` para `this.dat.items.has(word)` (consistente com o que ja fizemos em `readTileItems`).

**Arquivo: `packetParser.ts` — metodo `chgThing()`** (linhas 603-621):

Adicionar tratamento para CR_FULL e CR_KNOWN (o C++ `ParseTileSetObject` chama `ParseObject` que trata todos os tipos). Atualmente so tratamos CR_OLD e items.

| Arquivo | Mudanca |
|---------|---------|
| `packetParser.ts` | `addThing`: adicionar CR_OLD handler + usar `dat.items.has()` |
| `packetParser.ts` | `chgThing`: adicionar CR_FULL e CR_KNOWN handlers |

