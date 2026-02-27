

## Tornar o Player Fluido como Video (Smooth Walking + 60fps)

### Diagnostico

Analisando o codigo atual e comparando com o tibiarc C++ (`web_player.cpp`), identifiquei 3 problemas que fazem o player parecer "frame a frame":

1. **FPS travado em 20**: O animation loop em `TibiarcPlayer.tsx` tem `const FPS = 20` com throttling manual. O tibiarc C++ usa `emscripten_set_main_loop(MainLoop, 0, 0)` - ou seja, **sem cap de FPS**, roda na taxa nativa do monitor (60fps+).

2. **Sem interpolacao de movimento (walk offset)**: Quando uma criatura se move, o `moveCr` no parser seta `c.x = tx; c.y = ty` **instantaneamente**. O renderer desenha na posicao do tile sem nenhuma transicao. No tibiarc/OTClient, criaturas possuem um **walk offset em pixels** que vai de -32px ate 0px ao longo da duracao do passo, criando o efeito de deslizamento suave entre tiles.

3. **Animacao baseada em tick, nao em tempo real**: O `this.tick++` incrementa 1 por frame renderizado. Se o FPS cai, a animacao desacelera junto. No tibiarc, `g_currentTick` e baseado em `emscripten_get_now()` (tempo real), garantindo velocidade constante independente do FPS.

### Plano de Implementacao

#### 1. Adicionar walk offset ao Creature (`gameState.ts`)

Novos campos na interface `Creature`:
- `walkOffsetX: number` - offset em pixels (-32 a 0 ou 0 a 32)
- `walkOffsetY: number` - offset em pixels
- `walkStartTick: number` - quando o passo comecou
- `walkDuration: number` - duracao total do passo em ms

#### 2. Setar walk offset no moveCr (`packetParser.ts`)

Quando uma criatura se move de (fx,fy) para (tx,ty):
- Calcular direcao: dx = tx - fx, dy = ty - fy
- Setar `walkOffsetX = -dx * 32`, `walkOffsetY = -dy * 32` (comeca deslocado para tras)
- Setar `walkStartTick = performance.now()` e `walkDuration` baseado na speed
- O offset vai interpolar de (-32,0) ate (0,0) ao longo da duracao

#### 3. Interpolar posicao no renderer (`renderer.ts`)

No `drawCreatureNative`, antes de desenhar:
- Calcular `progress = (now - walkStartTick) / walkDuration` (0 a 1)
- Se progress < 1: `pixelOffsetX = walkOffsetX * (1 - progress)`, idem Y
- Se progress >= 1: offset = 0, walking = false
- Aplicar offset ao `bx` e `by` do desenho

O mesmo offset deve ser aplicado ao HUD (nome/barra de vida) para que acompanhem a criatura.

#### 4. Remover cap de FPS (`TibiarcPlayer.tsx`)

- Remover o throttle de 20 FPS (`const FPS = 20` e `if (time - lastTime < interval) return`)
- Deixar `requestAnimationFrame` rodar na taxa nativa (~60fps)
- Manter o calculo de tempo real para progressao da cam (ja esta correto)

#### 5. Usar tempo real para animacao de sprites (`renderer.ts`)

- Trocar `this.tick++` (incremento por frame) por um timestamp real
- Calcular phase de animacao como `Math.floor(performance.now() / 150) % frames` (150ms por frame, similar ao tibiarc)
- Isso garante que animacoes rodem na mesma velocidade independente do FPS

### Mudancas por Arquivo

**`src/lib/tibiaRelic/gameState.ts`**
- Adicionar campos `walkOffsetX`, `walkOffsetY`, `walkStartTick`, `walkDuration` na interface e factory

**`src/lib/tibiaRelic/packetParser.ts`**
- No `moveCr`: calcular e setar walk offset baseado na direcao e speed da criatura

**`src/lib/tibiaRelic/renderer.ts`**
- No `drawCreatureNative`: interpolar pixel offset baseado em `performance.now()`
- Aplicar offset ao HUD tambem
- Trocar `this.tick` por `performance.now()` para animacoes

**`src/components/TibiarcPlayer.tsx`**
- Remover throttle de 20 FPS no animation loop

### Resultado Esperado

- Criaturas deslizam suavemente entre tiles em vez de "teleportar"
- Animacoes rodam a ~60fps, visual fluido como video
- Velocidade de animacao constante independente do FPS do dispositivo

