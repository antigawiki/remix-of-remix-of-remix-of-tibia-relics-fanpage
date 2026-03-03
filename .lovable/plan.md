

## Diagnóstico Profundo: Desync, White Sprites e Mensagens

### 1. Mensagens ainda aparecendo na tela

**Causa confirmada:** O `web_player.cpp` atual liga `SkipRenderingPlayerNames` ao mesmo flag `g_skip_messages`. O usuário confirmou que esconder mensagens **não deve** esconder nomes de criaturas.

Mas o problema principal é outro: mesmo com todos os flags de skip ativados, as mensagens continuam. Isso indica que o tibiarc tem caminhos de renderização adicionais não cobertos pelos flags atuais. A função `DrawOverlay` provavelmente renderiza:
- Speech bubbles (chat sobre a cabeça dos players)
- Animated text (dano, healing, XP)
- Status messages

Esses podem ter flags adicionais no struct `Renderer::Options` que não estamos usando, ou podem ser renderizados incondicionalmente pelo tibiarc.

**Fix no `web_player.cpp`:**
1. Separar `SkipRenderingPlayerNames = false` (sempre visível)
2. Investigar o `renderer.hpp` do fork para campos adicionais do struct Options
3. Se não houver flag para speech bubbles: patch no `DrawOverlay` para skip quando `g_skip_messages = true`, ou adicionar `g_gamestate->Messages.Prune(0)` forçado antes de cada `RenderFrame` quando skip está ativo (limpa todas as mensagens pendentes)

### 2. Desync e Multi-Floor Reading

**Análise do sistema atual:**
O `getFloorRange` no JS parser lê:
- Superfície (z ≤ 7): floors 7→0 (8 andares), como o OTClient padrão
- Subsolo (z > 7): z-2 até z+2 (5 andares)

O protocolo Tibia envia tiles com sentinelas `0xFF00+` que indicam "skip N tiles". O skip count é propagado entre andares (`readFloorArea` retorna skip). Isso é correto para o protocolo padrão.

**Possível causa de desync:** O TibiaRelic é um servidor customizado 7.72. Se ele enviar **menos andares** que o esperado (ex: só 3 andares em vez de 8 na superfície), o parser continuaria lendo bytes do próximo opcode como se fossem tiles, corrompendo todo o stream.

**Evidência:** Os problemas de desync acontecem especialmente durante:
- `mapDesc` (0x64) que lê múltiplos andares
- `scroll` (0x65-0x68) que também lê multi-floor
- `floorUp`/`floorDown` (0xBE/0xBF)

**Fix proposto:** Adicionar instrumentação ao parser JS para contar quantos bytes cada `readMultiFloorArea` consome vs. quantos estavam disponíveis. Isso revelará se o parser está consumindo demais (desync) ou de menos (dados residuais). Essa informação permitirá ajustar `getFloorRange` para o formato real do TibiaRelic.

Nota: Isso afeta apenas as ferramentas JS (cam-analyzer, cam-map). O player WASM usa o parser C++ do tibiarc que tem sua própria lógica de multi-floor.

### 3. White Sprites no Cam Map

**Análise:** O `SprLoader` lê o count como `u16` (linha 19), correto para 7.72. Sprites com offset 0 retornam null, e `getSpriteCanvas` retorna null, fazendo `drawImage` não ser chamado. Portanto, tiles "brancos" não são sprites brancos — são tiles sem nenhum sprite válido, mostrando o fundo transparente do canvas (que o Leaflet renderiza como branco/cinza).

**Causas possíveis:**
- Item IDs corrompidos vindos do parser desync (cascata do problema #2)
- Item IDs que existem no .dat mas cujos spriteIds apontam para sprites inexistentes no .spr
- Tiles com dados de andares errados (perspectiva) gravados no banco

**Fix:** Antes de gravar tiles no banco durante a extração, validar que pelo menos o ground tile tem sprites resolvíveis. Tiles sem ground válido devem ser descartados.

### Plano de Mudanças

**Fase 1 — `web_player.cpp` (recompilação necessária):**
- `SkipRenderingPlayerNames = false` (sempre visível, separado de mensagens)
- Antes de `DrawOverlay`, se `g_skip_messages`: chamar `g_gamestate->Messages.Prune(g_currentTick.count() + 999999)` para limpar todas as mensagens pendentes, garantindo que nenhuma speech bubble seja desenhada
- Verificar no `renderer.hpp` se existem flags adicionais como `SkipRenderingAnimatedText`

**Fase 2 — Diagnóstico de multi-floor (JS):**
- Adicionar logging ao `readMultiFloorArea` para medir bytes consumidos por floor
- Comparar com o comportamento esperado para identificar desalinhamento
- Criar um modo "single-floor" no parser para testes comparativos

**Fase 3 — Validação de sprites na extração:**
- No pipeline de extração de tiles, filtrar tiles cujo ground sprite não é resolvível pelo SprLoader
- Isso elimina os quadrados brancos sem afetar a cobertura de tiles válidos

