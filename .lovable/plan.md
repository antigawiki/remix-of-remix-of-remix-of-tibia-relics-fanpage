

## Plano: Corrigir FloorUp (0xBE) para ler 3 andares na transição z=8→7

### O Bug

O `floorDown` (0xBF) quando `camZ === 8` (entrando no underground) lê **3 andares** em loop (z=8, 9, 10). Mas o `floorUp` (0xBE) quando `camZ === 7` (saindo do underground) lê apenas **1 andar** (z=5). O servidor envia 3 andares (z=7, 6, 5) — os ~600-900 bytes não consumidos corrompem todos os frames seguintes, causando:

- DESYNC player vs camera (delta=3 tiles, exatamente 1 por FloorUp não lido)
- camZ derivando para valores absurdos (z=4)
- 78 erros cascata em opcodes 0x6d/0x6b
- Ghosting e criaturas estátua

### A Correção

**Arquivo: `src/lib/tibiaRelic/packetParser.ts`** — método `floorUp` (linhas 810-840)

Espelhar a lógica do `floorDown`: quando `camZ === 7`, ler 3 andares em loop (z=5, 6, 7) com offsets j=+3, +2, +1 (simétricos ao j=-1, -2, -3 do floorDown).

```text
floorDown z=7→8:  lê z=8(j=-1), z=9(j=-2), z=10(j=-3)  ✓ já funciona
floorUp  z=8→7:   lê z=5(j=+3), z=6(j=+2), z=7(j=+1)   ✗ → FIX
```

Código atual (1 andar):
```typescript
if (g.camZ === 7) {
  const newFloor = Math.max(g.camZ - 2, 0);
  const offset = 8 - newFloor;
  this.readFloorArea(r, g.camX - 8, g.camY - 6, newFloor, 18, 14, offset, 0);
}
```

Código corrigido (3 andares em loop):
```typescript
if (g.camZ === 7) {
  let skip = 0;
  let j = 3; // offset starts at +3 (topmost floor z=5)
  for (let nz = Math.max(g.camZ - 2, 0); nz <= g.camZ; nz++) {
    skip = this.readFloorArea(r, g.camX - 8, g.camY - 6, nz, 18, 14, j, skip);
    if (skip < 0) { skip = 0; break; }
    j--;
  }
}
```

### Impacto esperado

- Consome todos os bytes do FloorUp (elimina os ~600-900B órfãos)
- Elimina o DESYNC de 3 tiles entre player e camera
- Elimina os 78+ erros cascata em opcodes subsequentes
- Corrige o drift de camZ para valores impossíveis

### Bugs secundários (não corrigidos agora)

Os erros em opcodes 0xa9 (Talk sub-type) e 0x43/0x46/0x52 (server custom) são problemas reais mas menores — podem ser endereçados depois de confirmar que o FloorUp fix resolve a cascata principal.

