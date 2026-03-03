

## Analise dos bytes do .cam e plano de acao

### O que descobri

O arquivo `.cam` **nao esta corrompido**. O problema esta no parser C++ do tibiarc (compilado no WASM), que e diferente do parser JS que voce ja tem no projeto. O C++ usa `Parser::Parse()` da biblioteca tibiarc, que foi projetada para protocolos Tibia genericos -- nao para o protocolo customizado do TibiaRelic 7.72.

Diferencas conhecidas entre o parser C++ (tibiarc) e o JS (`packetParser.ts`):

- **Statement GUID no talk (0xAA)**: O JS le 4 bytes extras que o TibiaRelic envia. O C++ provavelmente nao.
- **readStats (0xA0)**: O JS faz `skip(20)` (sem stamina). O C++ pode esperar um tamanho diferente.
- **Heuristica TCP/direct**: Ambos implementam, mas com logica ligeiramente diferente.
- **CreatureUnpass (0x92), MultiUseDelay (0xA6)**: Handlers customizados no JS que podem nao existir no C++.

Quando um desses opcodes e interpretado com tamanho errado, o parser perde o alinhamento dos bytes. Todos os opcodes seguintes ficam "deslocados" e o estado do jogo corrompe -- tiles sao limpos, criaturas somem, tela preta.

### A boa noticia

Voce ja tem **todos os componentes** para um player 100% JavaScript:

| Componente | Arquivo | Status |
|---|---|---|
| Parser .cam | `camParser.ts` | Completo |
| Parser protocolo | `packetParser.ts` | Completo, testado com map extraction |
| Estado do jogo | `gameState.ts` | Completo (tiles, criaturas, camera) |
| Loader sprites | `sprLoader.ts` | Completo |
| Loader .dat | `datLoader.ts` | Completo |
| Renderer | `renderer.ts` | Completo (items, criaturas, efeitos, projeteis, texto animado, HUD) |

O unico componente que falta e o **loop de playback** -- a logica que processa frames na hora certa e chama o renderer.

### Plano: Player JS puro (substituir o WASM)

#### 1. Criar `src/components/JsCamPlayer.tsx`

Novo componente que substitui o `TibiarcPlayer` na pagina `CamPlayerPage`:

- Carrega `Tibia.spr`, `Tibia.dat` (mesmos arquivos que o WASM usa, ~3MB total)
- Ao receber um `.cam`, usa `parseCamFile()` para extrair frames
- Cria `GameState` + `PacketParser` + `Renderer`
- Implementa loop de playback com `requestAnimationFrame`:

```text
Cada frame de animacao:
  1. Calcular tempo decorrido (com speed multiplier)
  2. Processar todos os frames .cam ate o timestamp atual
  3. Chamar renderer.draw() no canvas
```

- Seek: resetar `GameState`, reprocessar frames 0 ate target timestamp
- Controles: play/pause, speed (1x/2x/4x/8x), slider de progresso, fullscreen

#### 2. Otimizacao de seek com snapshots

Para evitar reprocessar milhares de frames em cada seek:

- A cada ~30s de playback, salvar um snapshot do `GameState` (ja tem `snapshot()/restore()`)
- No seek, restaurar o snapshot mais proximo anterior ao target e processar apenas os frames restantes
- Isso reduz o tempo de seek de "processar 26k frames" para "processar ~500 frames"

#### 3. Substituir na pagina

Atualizar `CamPlayerPage.tsx` para usar `JsCamPlayer` em vez de `TibiarcPlayer`.

### Vantagens

- **Controle total** sobre o parsing -- qualquer opcode pode ser ajustado
- **Zero dependencia de WASM** -- sem problemas de compilacao/recompilacao
- **Debugging facil** -- console.log em qualquer ponto do parser
- **Ja testado** -- o mesmo parser JS funciona perfeitamente para extracao de mapa

### Detalhes tecnicos

**Loop de playback:**
```text
requestAnimationFrame callback:
  elapsed = (now - lastTime) * speed
  currentMs += elapsed
  while (frameIndex < frames.length && frames[frameIndex].timestamp <= currentMs):
    parser.process(frames[frameIndex].payload)
    frameIndex++
  renderer.incTick()
  renderer.draw(canvasWidth, canvasHeight)
```

**Seek:**
```text
1. Encontrar snapshot mais proximo (ou resetar GameState se nenhum)
2. Processar frames do snapshot ate target
3. Renderizar frame atual
```

**Performance esperada:**
- O parser JS processa ~26k frames em <200ms (ja medido na extracao de mapa)
- O renderer JS ja roda a 60fps no canvas (testado)
- Seek sem snapshot: ~200ms. Com snapshots a cada 30s: ~20ms.

