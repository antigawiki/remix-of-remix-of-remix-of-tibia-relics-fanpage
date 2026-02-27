

## Corrigir Transicao de Tela Travada e Player Sumindo

### Diagnostico Principal

Comparando com o tibiarc C++ (`web_player.cpp`) e o comportamento do OTClient, identifiquei **3 bugs criticos** que causam os problemas reportados:

### Bug 1: Camera Nao Acompanha o Walk do Player (Tela "Trava")

**Causa raiz**: Quando o jogador anda, dois pacotes chegam quase simultaneamente:
- `scroll(dx, dy)` -> atualiza `camX/camY` **instantaneamente**
- `moveCr()` -> seta walk offset no player (anima de -32px a 0px)

O resultado: todos os tiles do mapa "pulam" para a nova posicao de uma vez, mas o sprite do player desliza suavemente. Isso cria o efeito de "tela travando" a cada passo.

**Correcao (como OTClient faz)**: No renderer, ao desenhar, aplicar o **walk offset do player** como deslocamento de toda a viewport. Assim, quando o player anda:
1. `scroll()` carrega os tiles novos (correto)
2. `moveCr()` seta o walk offset no player
3. O renderer desloca **todos os tiles** pelo walk offset do player, fazendo a tela inteira deslizar suavemente junto com o personagem

### Bug 2: Player Sumindo da Tela

**Causa raiz**: O HUD (nome/barra de vida) filtra criaturas com `c.z !== z`, mas durante mudancas de andar (`floorUp/floorDown`), o `camZ` muda antes do creature update. Alem disso, a area visivel para renderizacao de criaturas e `VP_W + 1` / `VP_H + 1`, o que pode cortar criaturas que estao exatamente na borda durante o walk offset.

**Correcao**: Expandir a margem de visibilidade do HUD de +1 para +3 tiles e garantir que a area de renderizacao do viewport cubra tiles extras para criaturas com walk offset ativo.

### Bug 3: Walk Duration Incorreta

**Causa raiz**: A formula atual `Math.max(100, Math.floor(1000 / (c.speed / 220)))` nao corresponde ao calculo do cliente real. No OTClient, a duracao do passo depende do `groundSpeed` do tile (atributo `speed` no DAT) e da velocidade da criatura:
- `stepDuration = groundSpeed * 1000 / creatureSpeed` (simplificado)
- O ground speed padrao e ~150 para grama normal

Com a formula atual, criaturas rapidas ficam com animacao muito lenta, e criaturas lentas ficam muito rapidas.

**Correcao**: Usar uma formula mais proxima do cliente real, considerando um ground speed fixo de 150 (sem acesso ao tile de origem, usamos valor padrao).

### Plano de Mudancas

#### `src/lib/tibiaRelic/renderer.ts`

1. **Smooth camera follow**: No metodo `draw()`, antes de renderizar os tiles, buscar o creature do player (`gs.playerId`) e calcular seu walk offset atual. Aplicar esse offset como deslocamento pixel a pixel de toda a viewport (subtrair do calculo de `bx/by` de cada tile).

2. **Expandir margem do HUD**: Mudar a verificacao de visibilidade do HUD de `tx2 <= VP_W + 1 && ty2 <= VP_H + 1` para `+3`, evitando criaturas cortadas na borda durante movimentacao.

3. **Aplicar camera offset ao HUD**: O mesmo offset de camera smooth deve ser aplicado ao posicionamento do HUD para que nomes/barras acompanhem o deslizamento.

#### `src/lib/tibiaRelic/packetParser.ts`

4. **Corrigir formula de walk duration**: Trocar `Math.max(100, Math.floor(1000 / (c.speed / 220)))` por formula baseada em ground speed: `Math.max(100, Math.floor(150 * 1000 / Math.max(1, c.speed)))` onde 150 e o ground speed padrao. Para diagonal, multiplicar por 3 (custo extra de diagonal no Tibia).

5. **Proteger walk durante scroll**: Quando `scroll()` e chamado (camera se move), nao resetar walks em andamento de criaturas que ja estao animando.

#### `src/lib/tibiaRelic/gameState.ts`

6. Nenhuma mudanca necessaria na interface - os campos de walk ja existem.

### Resultado Esperado

- A tela desliza suavemente quando o player anda, sem "pulos"
- O player nunca desaparece durante transicoes de tela
- A velocidade de caminhada das criaturas corresponde ao visual do jogo original
- Criaturas na borda da tela continuam visiveis durante o movimento

