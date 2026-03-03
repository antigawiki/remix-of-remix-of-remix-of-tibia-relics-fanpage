

## Diagnóstico: Causa Raiz dos Erros

### O Problema Central: Floor Range Incorreto

O parser JS usa a lógica padrão do OTClient para superfície (z ≤ 7):
```text
getFloorRange(z=7) → startz=7, endz=0 → 8 andares (7,6,5,4,3,2,1,0)
```

Mas o TibiaRelic envia **apenas ±2 andares** (confirmado pelo usuário). Isso significa que na superfície, o servidor envia no máximo 5 andares em vez de 8. O parser tenta ler 3 andares extras que **não existem no stream**, consumindo bytes dos próximos opcodes como se fossem tile data. Isso corrompe todo o resto da leitura.

**Efeito cascata:**
1. `readMultiFloorArea` consome bytes demais → desync
2. Próximos opcodes leem dados corrompidos → item IDs inválidos
3. Item IDs inválidos → sprites não resolvíveis → quadrados brancos no mapa
4. Bytes consumidos errados → crashes em sequência

### `floorUp` e `floorDown` também estão errados

`floorUp` (linha 751-756): quando camZ chega a 7 (saindo do subsolo), lê andares 5→0 com offsets fixos (6 andares). Se o servidor só envia 2-3, desync.

`floorDown` (linha 780-786): quando camZ chega a 8 (entrando no subsolo), lê z até z+2 (3 andares). Isso parece correto para ±2.

### Sobre iluminação

Os bytes de iluminação **já são consumidos** corretamente:
- World light (0x82): `r.u8(); r.u8()` ✓
- Creature light em `updateCreatureCommon`: `r.u8(); r.u8()` ✓
- Creature light update (0x8D): `r.u32(); r.u8(); r.u8()` ✓

A iluminação não causa crashes — o rendering de escuridão funciona no WASM (imagem 206).

### Sobre as mensagens

O WASM player **já funciona corretamente**: imagem 205 mostra nomes de criaturas visíveis (Kongra, Sibang) sem mensagens de chat. A correção anterior foi aplicada com sucesso.

---

### Plano de Correção

**1. Corrigir `getFloorRange` para ±2 andares em TODAS as situações:**

```typescript
private getFloorRange(z: number): { startz: number; endz: number; zstep: number } {
  if (z > 7) {
    return { startz: z - 2, endz: Math.min(z + 2, 15), zstep: 1 };
  } else {
    // TibiaRelic: ±2 floors only, not full 7→0
    return { startz: Math.min(z + 2, 7), endz: Math.max(z - 2, 0), zstep: -1 };
  }
}
```

Superfície z=7: lê 7→5 (3 andares em vez de 8)
Superfície z=6: lê 7→4 (4 andares)
Superfície z=5: lê 7→3 (5 andares — máximo ±2)

**2. Corrigir `floorUp` para ±2:**

Quando camZ atinge 7 (saindo do subsolo), em vez de ler 6 andares (5→0), ler apenas os andares visíveis (camZ-2 até 0 ou conforme ±2).

**3. Corrigir `floorDown` para ±2:**

Verificar que a lógica está alinhada com ±2.

**4. Adicionar safety guard no `readMultiFloorArea`:**

Se durante a leitura de um floor o buffer tiver bytes insuficientes para um tile completo, parar imediatamente em vez de tentar ler mais andares.

