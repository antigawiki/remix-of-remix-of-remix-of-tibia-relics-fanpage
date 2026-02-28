

## Plano: Corrigir renderizacao de tiles e restaurar criaturas multi-floor

### Problemas identificados

**1. Renderizacao de tiles simplificada demais**

O `drawItem` no `mapTileRenderer.ts` so desenha `spriteIds[0]`, ignorando completamente:
- **Multi-tile items** (width/height > 1): arvores, paredes grandes, escadas ocupam 2x2 ou 2x1 tiles. Cada sub-tile precisa do sprite correto, nao apenas o index 0.
- **Pattern matching** (patX/patY): bordas de terreno usam patterns baseados nas coordenadas mundiais (`wx % patX`, `wy % patY`). Sem isso, todas as bordas ficam iguais e o chao fica "errado".
- **Displacement** (dispX/dispY): itens com offset visual (ex: paredes que cobrem parcialmente o tile vizinho).

O renderer do CamPlayer (`renderer.ts`, linhas 506-521) faz tudo isso corretamente via `drawItemNative` + `getSpriteIndex`:

```text
getSpriteIndex: calcula indice com patX/patY baseado em wx/wy
drawItemNative: itera height x width e aplica displacement + elevation
```

**2. Criaturas de outros andares removidas**

No `snapshotCreaturesForVisit` (mapExtractor.ts, linha 159):
```
if (c.z !== camZ) continue;
```

Isso filtra criaturas de andares que o player nao esta pisando, mas o GameState pode conter criaturas de andares adjacentes que sao visualmente validas. O extrator antigo nao tinha esse filtro de Z.

---

### Solucao

#### 1. Corrigir `drawItem` no mapTileRenderer.ts

Reescrever `drawItem` para usar a mesma logica do CamPlayer:
- Iterar `height x width` para itens multi-tile
- Calcular sprite index usando `patX`, `patY` baseado nas coordenadas mundiais
- Aplicar `dispX`/`dispY` (displacement)
- Receber `wx`, `wy` como parametros para pattern matching

Nova assinatura: `drawItem(ctx, def, px, py, wx, wy)`

Adicionar metodo `getSpriteIndex` identico ao do renderer:
```
getSpriteIndex(it, wx, wy, tw, th):
  a=0, z=0, y=wy%patY, x=wx%patX, l=0
  idx = ((((((a*PZ+z)*PY+y)*PX+x)*L+l)*H+h)*W+w)
  return spriteIds[idx]
```

O loop de renderizacao no `renderChunk` passara `wx` e `wy` para `drawItem`.

#### 2. Restaurar criaturas de andares adjacentes

No `snapshotCreaturesForVisit`, remover o filtro `c.z !== camZ`. Aceitar criaturas de qualquer andar visivel (tipicamente camZ-2 a camZ+2 para underground, ou 0-7 para surface). Manter o filtro de proximidade horizontal que ja existe.

---

### Arquivos a modificar

1. **`src/lib/tibiaRelic/mapTileRenderer.ts`**:
   - Reescrever `drawItem` com multi-tile + pattern matching + displacement
   - Adicionar metodo `getSpriteIndex` (copia do renderer.ts)
   - Atualizar chamada no `renderChunk` para passar coordenadas mundiais

2. **`src/lib/tibiaRelic/mapExtractor.ts`**:
   - Remover `if (c.z !== camZ) continue;` na linha 159
   - Manter filtro de proximidade horizontal (abs(c.x - camX) > 20, etc.)

