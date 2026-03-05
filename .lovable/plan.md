

## Diagnóstico: Buffer travado em `readTileItems` causa corrupção em cascata

### Problema raiz

O log mostra **um único frame** (`[7250.84s]`) onde `readTileItems` lê `0x6865` (que em ASCII = "eh", texto corrompido), faz `r.pos -= 2` (rewind) e retorna `skip=0`. Mas `readFloorArea` continua iterando por TODAS as tiles (18×14 = 252 por andar × 8 andares = ~2016 chamadas), cada uma lendo o mesmo `0x6865` no pos=1510, rewind, retorna 0 — o buffer fica **travado**.

Após o `readMultiFloorArea` terminar sem consumir bytes, todos os opcodes subsequentes do frame são lidos a partir da posição errada (1510), causando corrupção permanente do estado.

Os logs confirmam:
- `bytesConsumed=0` em cada andar após o travamento
- `totalConsumed=548` (os primeiros 2-3 andares foram lidos ok, depois travou)
- `bytesLeft=569` — bytes restantes nunca são consumidos

### Causa provável da dessincronização inicial

Quando o jogador entra na cave (~59 min), o servidor TibiaRelic provavelmente envia **menos andares** do que o parser espera. O `getFloorRange` retorna 8 andares (7→0) para superfície, mas se o servidor enviar apenas 3-4, o parser consome bytes de **opcodes seguintes** como se fossem tiles — daí `0x6865` (que são bytes de outro opcode/string).

### Plano de correção (2 arquivos)

**1. `src/lib/tibiaRelic/packetParser.ts` — Detecção de buffer travado**

Em `readFloorArea`: salvar `r.pos` antes de chamar `readTileItems`. Se após a chamada `pos` não avançou E `skip === 0`, o buffer está travado — parar de ler este andar imediatamente.

```typescript
private readFloorArea(r, ox, oy, z, W, H, offset, skip) {
  for (tx...) {
    for (ty...) {
      if (r.left() < 2) return skip;
      if (skip > 0) { ... skip--; continue; }
      const posBefore = r.pos;
      skip = this.readTileItems(r, ...);
      // Se pos não avançou e skip=0, buffer travado — abortar andar
      if (r.pos === posBefore && skip === 0) return -1; // sentinel
    }
  }
  return skip;
}
```

Em `readMultiFloorArea`: se `readFloorArea` retornou `-1` (sentinel), parar de ler mais andares.

```typescript
skip = this.readFloorArea(r, ...);
if (skip < 0) {
  // Buffer stuck — stop reading floors
  break;
}
```

**2. `readFloorAreaWithOffset` — Mesmo fix** (usada em floorUp/floorDown)

Aplicar a mesma detecção de pos travado.

### Impacto

- Corrige o problema de corrupção em cascata no parser JS (debugger)
- Não corrige o player WASM (C++), mas o patch de DAT + try-catch já mitiga parcialmente
- Frames corrompidos terão tiles vazias (melhor que corromper TODO o estado restante)

### Arquivos alterados
- `src/lib/tibiaRelic/packetParser.ts` — readFloorArea, readFloorAreaWithOffset, readMultiFloorArea

