

## Correcao dos Bugs de Camera e Walk Animation - Baseado no Codigo Fonte do tibiarc

### Analise da Causa Raiz (referencia: tibiarc/lib/events.cpp)

Comparando nosso codigo com a implementacao oficial do tibiarc, identifiquei **duas diferencas criticas** que causam ambos os bugs:

---

### Bug 1: Boneco para de andar (Walk Animation perdida)

**Causa raiz confirmada:** No metodo `moveCr`, o fallback 1 verifica `candidateCr.x === fx && candidateCr.y === fy && candidateCr.z === fz` antes de aceitar a criatura no stackpos. **O tibiarc NAO faz essa verificacao.** Ele simplesmente confia no stackpos:

```text
tibiarc (events.cpp, linha 90-100):
  auto &movedObject = fromTile.GetObject(version, StackPosition);
  if (!movedObject.IsCreature()) throw InvalidDataError();
  creatureId = movedObject.CreatureId;
  fromTile.RemoveObject(version, StackPosition);
  // ^ Nenhuma verificacao de posicao! Confia no stackpos.
```

O problema: quando `readTileItems` processa um tile (via scroll/mapDesc/tileUpd), ele atualiza `c.x/y/z` da criatura para a nova posicao do tile. Quando `moveCr` chega depois com as coordenadas ANTIGAS como origem, a verificacao `candidateCr.x === fx` FALHA porque a posicao ja foi atualizada. Resultado: `cid = null`, movimento descartado, sem animacao.

**Correcao:** Remover a verificacao de posicao em TODOS os fallbacks do `moveCr`. Confiar no stackpos (como tibiarc faz).

**Arquivo: `src/lib/tibiaRelic/packetParser.ts`** - metodo `moveCr`, linhas 520-526:

Antes:
```typescript
if (sp >= 0 && sp < ft.length && ft[sp][0] === 'cr') {
  const candidateCr = this.gs.creatures.get(ft[sp][1]);
  if (candidateCr && candidateCr.x === fx && candidateCr.y === fy && candidateCr.z === fz) {
    cid = ft[sp][1];
    ft.splice(sp, 1);
    this.gs.setTile(fx, fy, fz, ft);
  }
}
```

Depois:
```typescript
if (sp >= 0 && sp < ft.length && ft[sp][0] === 'cr') {
  cid = ft[sp][1];
  ft.splice(sp, 1);
  this.gs.setTile(fx, fy, fz, ft);
}
```

Mesma simplificacao no fallback 2 (linhas 530-541) -- remover a verificacao `cc.x === fx`:

Antes:
```typescript
if (cid === null) {
  for (let i = 0; i < ft.length; i++) {
    if (ft[i][0] === 'cr') {
      const cc = this.gs.creatures.get(ft[i][1]);
      if (cc && cc.x === fx && cc.y === fy && cc.z === fz) {
        cid = ft[i][1];
        ft.splice(i, 1);
        this.gs.setTile(fx, fy, fz, ft);
        break;
      }
    }
  }
}
```

Depois:
```typescript
if (cid === null) {
  for (let i = 0; i < ft.length; i++) {
    if (ft[i][0] === 'cr') {
      cid = ft[i][1];
      ft.splice(i, 1);
      this.gs.setTile(fx, fy, fz, ft);
      break;
    }
  }
}
```

---

### Bug 1b: Duracao do walk incorreta

**Causa raiz confirmada:** Usamos `groundSpeed = 150` hardcoded. O tibiarc usa a propriedade `Speed` do tile de destino (da DAT):

```text
tibiarc (events.cpp, linha 163-166):
  creature.WalkEndTick = gamestate.CurrentTick +
    (groundType.Properties.Speed * 1000) / movementSpeed;
```

**Correcao:** Buscar o speed do ground tile do destino via `this.dat.items`:

```typescript
// Buscar ground speed do tile de destino
const destTile = this.gs.getTile(tx, ty, tz);
let groundSpeed = 150; // fallback
for (const ti of destTile) {
  if (ti[0] === 'it') {
    const it = this.dat.items.get(ti[1]);
    if (it && it.isGround && it.stackPrio === 0 && it.speed > 0) {
      groundSpeed = it.speed;
      break;
    }
  }
}
const walkDuration = c.speed > 0
  ? Math.max(100, Math.floor(groundSpeed * 1000 / Math.max(1, c.speed)))
  : 300;
```

---

### Bug 1c: Walk animation em cross-floor e teleports deve ser instantanea

**Causa raiz confirmada:** O tibiarc desativa walk animation quando `zDifference !== 0` ou quando a distancia e maior que 1 tile. Nosso codigo so verifica `dx !== 0 || dy !== 0`.

```text
tibiarc (events.cpp, linha 137-139):
  if (zDifference == 0 &&
      (abs(xDifference) <= 1 && abs(yDifference) <= 1) &&
      toTile.ObjectCount > 0) {
      // animate walk
  } else {
      // instant movement (no walk)
  }
```

**Correcao:** Adicionar as mesmas verificacoes:
```typescript
const dz = tz - fz;
if (!this.seekMode && dz === 0 &&
    (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) &&
    (dx !== 0 || dy !== 0)) {
  // animate walk
}
```

---

### Bug 2: Camera desincronizada do andar do player

**Causa raiz:** Quando `moveCr` move o player para outro Z (raro, mas possivel em teleports), `player.z` muda mas `g.camZ` nao. O renderer usa `player.x/y` para centralizacao mas `g.camZ` para o andar, criando o desync.

No tibiarc, `PlayerMoved` e um evento SEPARADO que atualiza `Map.Position` (equivalente a `g.camX/Y/Z`). Movimentos de criatura NAO alteram a posicao do mapa. A camera so muda via `PlayerMoved`, `MapDescription`, `FloorUp`, `FloorDown`.

**Correcao mais segura (logging + safety net minimo):** Em vez de tentar sincronizar camZ no moveCr (que ja mostrou causar problemas), adicionar logging diagnostico para identificar QUANDO o desync acontece, e um safety net sutil no renderer:

No `renderer.ts`, em vez de usar `player.z` para overrride (que quebrou tudo antes), adicionar um log quando detectar divergencia:

```typescript
if (player && player.z !== g.camZ && !this.floorOverride) {
  console.warn(`[Renderer] Floor desync: player.z=${player.z} camZ=${g.camZ}`);
}
```

E no `moveCr`, quando o player muda de Z, emitir um warning:

```typescript
if (cid === this.gs.playerId && tz !== fz) {
  console.warn(`[moveCr] Player Z changed: ${fz} -> ${tz}, camZ=${this.gs.camZ}`);
}
```

Isso nos permite identificar a causa raiz exata sem quebrar a renderizacao.

---

### Resumo das mudancas

| Arquivo | Mudanca |
|---|---|
| `packetParser.ts` | Remover verificacao de posicao nos fallbacks do moveCr (confiar no stackpos como tibiarc) |
| `packetParser.ts` | Usar ground tile speed da DAT para duracao do walk |
| `packetParser.ts` | Desativar walk animation em cross-floor moves e teleports |
| `packetParser.ts` | Logging diagnostico quando player muda de Z via moveCr |
| `renderer.ts` | Logging diagnostico quando player.z diverge de camZ |

### Por que esse plano vai funcionar

1. A correcao principal (remover verificacao de posicao) e baseada DIRETAMENTE no codigo fonte do tibiarc oficial -- nao e heuristica, e como o sistema foi projetado
2. A correcao de walk duration vai fazer as animacoes parecerem mais naturais
3. A desativacao de walk em cross-floor previne animacoes impossveis
4. O logging ajuda a identificar o bug de floor desync sem arriscar quebrar a renderizacao novamente

