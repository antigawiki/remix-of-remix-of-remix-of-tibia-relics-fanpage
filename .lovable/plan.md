

## Filtrar WALK_FAIL por viewport da câmera

### Problema
Todos os `WALK_FAIL` são logados, incluindo criaturas fora do viewport (tiles vazias por scroll/mudança de andar). Isso gera ruído massivo no debugger.

### Solução
No `packetParser.ts`, antes de logar `WALK_FAIL`, verificar se a posição de origem (`fx, fy, fz`) está dentro do viewport da câmera. Se estiver fora, suprimir o log.

### Viewport check
O viewport do Tibia é 18×14 tiles centrado na câmera. A condição:

```typescript
const inViewport = 
  fz === this.gs.camZ &&
  fx >= this.gs.camX - 8 && fx <= this.gs.camX + 9 &&
  fy >= this.gs.camY - 6 && fy <= this.gs.camY + 7;
```

### Alteração

**`src/lib/tibiaRelic/packetParser.ts`** (~linhas 798-807): Envolver o log de `WALK_FAIL` com a verificação de viewport:

```typescript
} else {
  // WALK_FAIL — only log if within camera viewport to reduce noise
  const dl = this.debugLogger;
  if (dl && dl.enabled) {
    const inViewport =
      fz === this.gs.camZ &&
      fx >= this.gs.camX - 8 && fx <= this.gs.camX + 9 &&
      fy >= this.gs.camY - 6 && fy <= this.gs.camY + 7;
    if (inViewport) {
      dl.log('WALK_FAIL', {
        fromX: fx, fromY: fy, fromZ: fz,
        toX: tx, toY: ty, toZ: tz,
        stackpos: sp, tileLength: this.gs.getTile(fx, fy, fz).length,
      });
    }
  }
}
```

Nenhuma outra alteração necessária — os contadores e filtros no `CamFrameDebugger` e `CamDebugPanel` já consomem os eventos do logger normalmente.

