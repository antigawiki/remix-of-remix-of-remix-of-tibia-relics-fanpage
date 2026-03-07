

## Analise Completa: Por que a Renderizacao e Diferente

### Diferenças encontradas entre os dois projetos

Apos comparar linha por linha o Cam Mapper de referencia com nosso sistema, identifiquei **3 camadas de problemas**:

---

### 1. Dados corrompidos no banco (causa primaria)

Os tiles no banco foram extraidos com o DatLoader antigo (flag 0x00 consumindo 3 bytes). Isso causou byte drift no `readItemExtra()` — itens stackable/fluid nao foram detectados, desalinhando a leitura de tiles subsequentes. **Os item IDs salvos no banco estao errados.** Nenhuma correcao de renderer vai consertar dados ruins.

### 2. Renderer muito complexo vs referencia simples

O Cam Mapper de referencia usa uma logica de renderizacao extremamente simples que funciona perfeitamente:

```text
Referencia (MapCanvas.tsx):
- Single-tile: desenha o PRIMEIRO sprite valido, sem patterns
- Multi-tile:  idx = sy * w + sx (indice plano)
- Sem elevation, sem displacement, sem layers
- Minimap color como background de cada tile

Nosso (mapTileRenderer.ts):
- getItemSpriteIndex com formula complexa de patterns/layers/animation
- Elevation acumulada por item
- Displacement (dispX/dispY)
- Sistema de chunks 8x8 com margin/border tiles
```

O nosso renderer tenta ser mais sofisticado mas introduz bugs: a formula de patterns pode selecionar sprites errados, a elevation acumula offsets incorretos, e o sistema de chunks causa bordas pretas entre chunks.

### 3. DatLoader com flags extras nao-validadas

Nosso DatLoader tem flags 0x20 (cloth), 0x21 (market), 0x22 (usable) que o de referencia nao tem. Se o DAT do Relic nao usa essas flags, elas podem causar falsos positivos no metadata extraction (Phase 2).

---

### Plano de Correcao

**Arquivo: `src/lib/tibiaRelic/mapTileRenderer.ts`**

1. **Simplificar `drawItem`** — Alinhar com a logica da referencia:
   - Single-tile: desenhar o primeiro spriteId valido (sem patterns/layers/animation)
   - Multi-tile: usar `idx = sy * w + sx` (indice plano simples)
   - Remover elevation acumulada e displacement

2. **Adicionar background color por tile** — Antes de desenhar sprites, pintar um background solido baseado no primeiro item ground (evita transparencia/preto entre sprites)

3. **Manter sistema de chunks com margin** — O LeafletJS precisa de chunks, mas simplificar a renderizacao dentro deles

4. **Remover separacao ground/normal e reverse** — Desenhar items na ordem original (como a referencia faz)

**Arquivo: `src/lib/tibiaRelic/datLoader.ts`**

5. **Remover flags 0x20-0x22** — Se nao existem no DAT 7.6, podem causar falsa leitura de bytes

**Apos as correcoes de codigo:**

6. **Re-extrair todos os .cam files** — Os dados atuais no banco estao corrompidos. Sem re-extracao, os item IDs continuarao errados independente da qualidade do renderer.

