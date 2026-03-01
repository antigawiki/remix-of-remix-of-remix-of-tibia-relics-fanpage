

## Correção de 2 Bugs no CamPlayer: Desync de Andar e Animação de Walk

### Bug 1: Camera mostrando andar errado (Floor Desync)

**Causa raiz:** O renderer usa `g.camZ` para determinar o andar, mas `player.z` para centralizar X/Y. Quando `moveCr` move o player entre andares (ex: teleport, escada), ele atualiza `player.z` mas NAO atualiza `g.camZ`. O resultado: o renderer mostra tiles do andar antigo (camZ) mas centrado nas coordenadas do player que ja esta em outro andar.

Exemplo: player esta no z=7 (superficie). O servidor envia um `moveCr` movendo o player para z=8 (subterraneo). `player.z` vira 8, mas `g.camZ` continua 7. O renderer desenha o mapa do andar 7 usando coordenadas do andar 8.

**Correção:** No `moveCr` do `packetParser.ts`, quando a criatura movida e o player E o z muda, sincronizar `g.camZ` com o novo z do player. Tambem adicionar um safety check no renderer: se `player.z !== g.camZ` e nao ha floorOverride, usar `player.z` como floor de referencia.

**Arquivo: `src/lib/tibiaRelic/packetParser.ts`** - No metodo `moveCr`, apos `c.x = tx; c.y = ty; c.z = tz;` (linha 574), adicionar:
```typescript
// If player moved to a different floor, sync camera
if (cid === this.gs.playerId && tz !== fz) {
  const oldZ = this.gs.camZ;
  this.gs.camX = tx;
  this.gs.camY = ty;
  this.gs.camZ = tz;
  this.clampCamZ();
  this.cleanupDistantCreatures(tz);
}
```

**Arquivo: `src/lib/tibiaRelic/renderer.ts`** - No metodo `draw()`, adicionar safety check para usar `player.z` quando nao ha floorOverride e player.z difere de camZ:
```typescript
const renderCamZ = (player && !this.floorOverride && player.z !== g.camZ) ? player.z : g.camZ;
```

---

### Bug 2: Player para de andar (Walk Animation perdida)

**Causa raiz:** No `moveCr`, o codigo tenta encontrar a criatura no tile de origem em 3 etapas (stackpos exato, posicao matching, qualquer criatura). Se TODAS falham, `cid` fica `null` e o movimento inteiro e descartado -- a criatura nao e movida, nao recebe animacao de walk, e "aparece" na proxima posicao quando o servidor atualiza o tile.

Isso acontece quando o tile de origem ja foi limpo por outro pacote (ex: tileUpd, ou outro moveCr que removeu a criatura antes), OU quando as coordenadas armazenadas na criatura nao batem com o tile de origem (drift acumulado).

**Correção:** Adicionar um 4o fallback no `moveCr`: se nenhuma criatura foi encontrada no tile de origem, buscar por QUALQUER criatura no `gs.creatures` cujas coordenadas armazenadas (c.x, c.y, c.z) correspondam ao tile de origem. Isso garante que mesmo que a referencia no tile tenha sido removida, o movimento ainda e processado.

**Arquivo: `src/lib/tibiaRelic/packetParser.ts`** - No metodo `moveCr`, apos o fallback 3 (linha 554), adicionar:
```typescript
// 4. Global fallback: find creature by stored position
if (cid === null) {
  for (const [id, cc] of this.gs.creatures) {
    if (cc.x === fx && cc.y === fy && cc.z === fz && id !== this.gs.playerId) {
      cid = id;
      break;
    }
  }
}
```

Tambem mover a logica de walk animation para DEPOIS da busca da criatura, para garantir que mesmo criaturas encontradas via fallback recebam animacao.

### Resumo das mudancas

| Arquivo | Mudanca |
|---|---|
| `src/lib/tibiaRelic/packetParser.ts` | Sync camZ quando player muda de andar via moveCr; Adicionar 4o fallback para encontrar criatura |
| `src/lib/tibiaRelic/renderer.ts` | Safety check: usar player.z quando diverge de camZ |

