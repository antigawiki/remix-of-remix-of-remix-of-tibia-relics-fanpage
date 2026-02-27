

## Correcao: Viewport Off-Center + Floor Camera Desync

### Diagnostico Detalhado

Apos analise aprofundada comparando com OTClient, identifiquei **duas causas raiz concretas**:

### BUG 1: Viewport deslocado 1 tile (player nao esta no centro)

No OTClient, a area de leitura do mapa e 18x14 tiles, mas a viewport visivel e 15x11. O OTClient aplica um offset de `(18-15-1)/2 = 1` tile horizontalmente e `(14-11-1)/2 = 1` tile verticalmente para centralizar o player. Nosso renderer usa `cx0 = renderCamX - 8`, colocando o player no tile 8 da tela (pixel 256 de 480). O correto e tile 7 (pixel 224, centro exato).

**Correcao**: Mudar `cx0 = renderCamX - 7 + offset` e `cy0 = renderCamY - 5 + offset`. Atualizar tambem o calculo de posicao do HUD.

### BUG 2: Camera floor usa `player.z` que pode estar desatualizado

O renderer usa `renderCamZ = player.z` como floor da camera. Porem, durante transicoes de floor, se o parsing parcialmente falha (erro no TCP demux, BufOverflow no meio da leitura de tiles), `player.z` pode ficar preso no floor anterior enquanto `g.camZ` ja foi atualizado. Resultado: camera mostra floor errado.

**Correcao**: Usar `g.camZ` como fonte autoritativa do floor da camera, nao `player.z`. O `g.camZ` e SEMPRE atualizado antes da leitura de tiles nos handlers floorUp/floorDown/mapDesc. Mesmo que a leitura de tiles falhe, o revert no catch ja cuida de restaurar `g.camZ`.

### Implementacao

#### Arquivo: `src/lib/tibiaRelic/renderer.ts`

**1. Corrigir fonte da camera (usar g.camX/Y/Z em vez de player.x/y/z):**

```text
// ANTES:
const renderCamX = player ? player.x : g.camX;
const renderCamY = player ? player.y : g.camY;
const renderCamZ = player ? player.z : g.camZ;

// DEPOIS:
const renderCamX = g.camX;
const renderCamY = g.camY;
const renderCamZ = g.camZ;
```

O `g.camX/Y/Z` e a fonte autoritativa do protocolo. A posicao do player e usada apenas para walk offset (smooth scrolling), nao para a posicao base da camera.

**2. Corrigir offset do viewport (centralizar player):**

```text
// ANTES:
const cx0 = renderCamX - 8 + offset;
const cy0 = renderCamY - 6 + offset;

// DEPOIS (OTClient-aligned):
const cx0 = renderCamX - 7 + offset;
const cy0 = renderCamY - 5 + offset;
```

**3. Atualizar calculo HUD para mesma origem:**

```text
// ANTES:
const tx2 = c.x - (renderCamX - 8);
const ty2 = c.y - (renderCamY - 6);

// DEPOIS:
const tx2 = c.x - (renderCamX - 7);
const ty2 = c.y - (renderCamY - 5);
```

**4. Atualizar calcFirstVisibleFloor para usar mesmas coordenadas:**

Verificar que o metodo recebe `renderCamX/Y` corretos (agora `g.camX/Y`).

### Resultado Esperado

- Player exatamente no centro da viewport (tile 7 de 15 horizontal, tile 5 de 11 vertical)
- Floor da camera sempre sincronizado com o protocolo (g.camZ)
- Sem mais "nomes fantasma" em floors errados apos transicoes
- Walk offset continua funcionando para smooth scrolling

