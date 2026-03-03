

## Analise da Diagnostico do Claude — O que faz sentido e o que nao

### BUG 1 — Mini `0x64` (MAP_DESC sem tiles): **PARCIALMENTE CORRETO, MAS O MECANISMO NAO E EXATAMENTE COMO ELE DESCREVE**

O Claude diz que o servidor envia `0x64` com apenas 6 bytes (opcode + x + y + z, sem tile data). Isso e plausivel para um servidor custom.

Porem, olhando o codigo atual do `readTileItems` (linha 879), ele tem o guard `while (r.left() >= 2)`. Se o 0x64 esta sozinho em um frame com apenas 6 bytes, apos ler pos3 restam 0 bytes, e `readMultiFloorArea` simplesmente retorna sem ler nada. **Nao ha crash nesse caso.**

**O problema REAL acontece quando o 0x64 curto esta dentro de um frame maior com outros opcodes depois.** Nesse caso, `readMultiFloorArea` → `readFloorArea` → `readTileItems` comeca a ler os PROXIMOS opcodes (0xA0, 0x6D, etc.) como se fossem dados de tile. Um opcode 0x6D (109) seria lido como item ID 109, que e um item valido no .dat. O stream fica completamente dessincronizado.

**Veredicto: O diagnostico esta correto na essencia. O fix proposto (peek next byte) e fragil demais.**

**Fix melhor**: Antes de `readMultiFloorArea`, verificar `r.left()`. Um MAP_DESC completo de 18x14 tiles em 7+ andares precisa de centenas de bytes. Se `r.left() < 100`, tratar como position-only update (so atualizar camX/Y/Z e chamar syncPlayerToCamera).

### BUG 2 — Bulk Tile Update pos-0x6D: **ESPECULATIVO, SEM EVIDENCIA SOLIDA**

O Claude diz que apos um 0x6D normal, o servidor anexa dados extras com 0x0E como header. 

Olhando o dispatch (linha 265-418), 0x0E NAO e um opcode reconhecido — `dispatch` retorna `false`. O `processOpcodes` (linha 226-248) entao faz fallback para TCP demux (`processTcpDemux`), que tenta ler u16 length prefix + sub-packets. Isso pode ou nao funcionar dependendo dos bytes.

**Mas**: 0x0E nao tem nada a ver com 0x6D especificamente. E simplesmente um opcode desconhecido que aparece no stream. O "bulk tile update" e uma especulacao sem evidencia nos dados.

**Veredicto: O mecanismo de fallback para TCP demux em opcodes desconhecidos ja existe e funciona como safety net. Nao ha fix especifico necessario aqui, a menos que tenhamos evidencia de dados reais.**

### BUG 3 — Creature IDs codificam posicao: **IRRELEVANTE**

O parser usa creature IDs como chaves em `Map<number, Creature>`. O valor do ID nao importa. Isso so seria problema se algum codigo assumisse que IDs sao sequenciais ou pequenos, o que nao acontece.

**Veredicto: Nao e um bug.**

---

## O que realmente precisamos fazer

O unico fix concreto e valioso e o **BUG 1**: proteger o `mapDesc` contra payloads curtos. Este e quase certamente a causa raiz dos saltos periodicos (~12s).

### Mudancas

**`src/lib/tibiaRelic/packetParser.ts` — metodo `mapDesc()`** (linha 428-448):

Apos ler `pos3(r)`, verificar `r.left()` antes de chamar `readMultiFloorArea`:

```text
mapDesc(r):
  pos3 → x, y, z
  atualiza camX, camY, camZ
  
  // NOVO: se restam poucos bytes, é position-only update
  if (r.left() < 100) {
    // Mini MAP_DESC — servidor custom enviou só posição
    syncPlayerToCamera(prevZ)
    return
  }
  
  // Fluxo normal: ler area de tiles
  readMultiFloorArea(...)
  syncPlayerToCamera(prevZ)
```

Isso e uma mudanca minima (3-4 linhas) que protege contra o cenario exato descrito pelo Claude, sem risco de quebrar o fluxo normal.

### Sobre o WASM player (C++)

O Claude sugere corrigir no C++. Ele esta correto que o **mesmo bug existe no tibiarc C++** — o `0x64` handler do tibiarc tambem assume MAP_DESC completo. Porem, nao temos controle sobre o codigo C++ da libtibiarc (e um binario pre-compilado). O fix no parser JS resolve o problema para o analyzer e para qualquer uso JS. O WASM player continuara com o bug ate recompilarmos o tibiarc.

### Resumo

- BUG 1: **Correto** — fix simples no `mapDesc()`, verificar bytes restantes
- BUG 2: **Especulativo** — nao agir sem evidencia
- BUG 3: **Irrelevante**

