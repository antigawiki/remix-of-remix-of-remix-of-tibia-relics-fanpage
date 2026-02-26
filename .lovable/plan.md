

## Melhorar Qualidade Grafica do Cam Player

### Problema Identificado

Comparando as screenshots do player original vs o nosso, ha 3 causas principais de diferenca visual:

### 1. devicePixelRatio ignorado (causa principal de "blur")

Em telas retina/HiDPI (a maioria dos monitores modernos tem devicePixelRatio = 2), o canvas tem 960 pixels internos mas ocupa 1920 pixels fisicos. O browser faz upscale 2x, deixando tudo embaçado. O tibiarc/OTClient renderizam na resolucao nativa do dispositivo.

**Fix**: Multiplicar a resolucao do canvas por `window.devicePixelRatio` no ResizeObserver.

### 2. Sprites escalados individualmente em vez de viewport inteiro

Cada sprite e pre-escalado de 32px para `tpx` (ex: 64px) individualmente via `drawImage` com `imageSmoothingEnabled = false`. Quando `tpx` nao e multiplo exato de 32 (ex: canvas 940px / 15 = 62.6, floor = 62), ha arredondamento que causa gaps de 1px entre tiles e bordas irregulares.

**Fix**: Renderizar tudo em um offscreen canvas de resolucao nativa (15*32=480 x 11*32=352) e depois escalar o resultado inteiro para o canvas de display. Isso garante sprites pixel-perfect e alinhamento perfeito entre tiles.

### 3. Texto do HUD com fonte e tamanho inadequados

O nome e barra de vida das criaturas usa fonte Arial em tamanhos muito pequenos (7-10px) que nao renderiza bem em pixel art. O cliente original usa bitmap fonts de tamanho fixo.

**Fix**: Renderizar o HUD depois do upscale (no canvas final, nao no offscreen), para que texto use a resolucao completa do display.

### Plano de Implementacao

**Arquivo: `src/lib/tibiaRelic/renderer.ts`**

1. Alterar `draw()` para sempre renderizar na resolucao nativa (480x352) em um offscreen canvas interno
2. Depois, copiar o offscreen canvas para o canvas real com scale up e `imageSmoothingEnabled = false`
3. Separar o desenho do HUD (nomes/barras) para acontecer APOS o upscale, no canvas final em resolucao nativa do display
4. Remover toda logica de `tpx` variavel e `scale` - sprites sempre em 32px

**Arquivo: `src/components/TibiarcPlayer.tsx`**

1. Atualizar ResizeObserver para considerar `devicePixelRatio` na resolucao do canvas
2. O canvas CSS continua em `aspect-[15/11]`, mas a resolucao interna sera `width * dpr` x `height * dpr`

### Resultado Esperado

```text
Antes:
  Canvas: 960x704 pixels internos
  Sprites: 32px -> 64px (escala individual, possivel fracao)
  Tela retina: browser upscale 2x -> borrado

Depois:
  Offscreen: 480x352 fixo (sprites em 32px nativo)
  Canvas: 1920x1408 em retina (960*2 x 704*2)
  Um unico drawImage escala 480->1920 com nearest-neighbor
  HUD (texto) renderizado apos upscale na resolucao do display
  -> pixel-perfect, crisp, sem gaps entre tiles
```

### Arquivos a Modificar
- `src/lib/tibiaRelic/renderer.ts` - Offscreen canvas + separar HUD
- `src/components/TibiarcPlayer.tsx` - devicePixelRatio no ResizeObserver

