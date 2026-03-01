

## Ferramenta de Depuracao em Tempo Real para o CamPlayer

### Objetivo

Criar um sistema de logging estruturado que registra TODOS os eventos relevantes do protocolo durante a reproducao de um `.cam`, permitindo identificar o momento exato em que a camera desincroniza ou o boneco para de andar. Os logs serao exibidos em um painel lateral colapsavel dentro do proprio player.

---

### Componente 1: Sistema de Debug Logger (`src/lib/tibiaRelic/debugLogger.ts`)

Novo arquivo que centraliza todos os registros de debug:

```text
- Classe DebugLogger com buffer circular (ultimos 2000 eventos)
- Cada evento tem: timestamp (ms do .cam), tipo, dados estruturados
- Tipos de evento:
  - OPCODE: qual opcode foi processado
  - MOVE_CR: from/to/cid/stackpos/fallbackUsed/walkAnimated
  - FLOOR_CHANGE: floorUp/floorDn/mapDesc com oldZ/newZ/camXYZ
  - SYNC_PLAYER: quando syncPlayerToCamera roda e o que mudou
  - PLAYER_POS: opcode 0x9A (posicao explicita do player)
  - DESYNC: quando player.z != camZ (detectado no renderer)
  - WALK_FAIL: quando moveCr nao encontrou criatura (cid=null)
  - TILE_UPDATE: readTileItems que afeta o player
  - SCROLL: direcao e nova posicao da camera
- Metodo export(): gera JSON ou texto para download
- Flag enabled (desligado por padrao, nao impacta performance)
```

### Componente 2: Instrumentacao do PacketParser

Modificar `packetParser.ts` para aceitar um `DebugLogger` opcional e registrar eventos criticos:

- No `dispatch()`: registrar cada opcode processado (apenas os relevantes para mapa/movimento)
- No `moveCr()`: registrar TODOS os detalhes — from/to, stackpos, qual fallback encontrou a criatura, se walk animation foi ativada, se cid ficou null
- No `floorUp()`/`floorDown()`: registrar mudanca de andar com antes/depois
- No `syncPlayerToCamera()`: registrar quando player e camera divergem e o que foi corrigido
- No `mapDesc()`: registrar nova posicao da camera
- No `scroll()`: registrar direcao e nova posicao
- No opcode `0x9A` (player pos): registrar posicao recebida vs estado atual

### Componente 3: Instrumentacao do Renderer

Modificar `renderer.ts` para registrar:

- Quando `player.z !== g.camZ` (desync detectado)
- Valores usados para renderizacao (renderCamX/Y/Z, floorOverride)

### Componente 4: Painel de Debug no UI (`src/components/CamDebugPanel.tsx`)

Novo componente colapsavel no `TibiarcPlayer`:

```text
- Botao "Debug" no rodape dos controles (icone de bug)
- Ao clicar, abre um painel abaixo do player com:
  - Lista scrollavel dos ultimos eventos (auto-scroll)
  - Filtros por tipo (MOVE_CR, FLOOR_CHANGE, DESYNC, WALK_FAIL)
  - Indicadores em tempo real:
    - camX/Y/Z atual
    - player.x/y/z atual
    - player.z == camZ? (verde/vermelho)
    - Numero de criaturas ativas
    - Ultimo moveCr: cid/from/to/fallback
  - Botao "Exportar Log" para download do historico completo
  - Highlight vermelho para eventos DESYNC e WALK_FAIL
- Quando desativado, o logger fica off e nao impacta performance
```

### Componente 5: Integracao com TibiarcPlayer

- Adicionar estado `debugMode` ao `TibiarcPlayer`
- Quando ativado, instanciar `DebugLogger` e passar ao `PacketParser` e `Renderer`
- O painel de debug usa `useRef` para acessar o logger sem causar re-renders
- Atualiza a cada 200ms via intervalo (nao a cada frame)

---

### Resumo dos arquivos

| Arquivo | Acao |
|---|---|
| `src/lib/tibiaRelic/debugLogger.ts` | NOVO - classe DebugLogger com buffer circular |
| `src/lib/tibiaRelic/packetParser.ts` | EDITAR - adicionar logging nos metodos criticos |
| `src/lib/tibiaRelic/renderer.ts` | EDITAR - adicionar logging de desync |
| `src/components/CamDebugPanel.tsx` | NOVO - painel visual de debug |
| `src/components/TibiarcPlayer.tsx` | EDITAR - integrar debug panel e logger |

### Por que isso vai ajudar

Em vez de adivinhar a causa dos bugs, o painel mostra em tempo real:
1. O momento exato em que `player.z` diverge de `camZ`
2. Qual opcode causou a divergencia
3. Quando `moveCr` falha em encontrar a criatura (walk animation perdida)
4. O estado completo antes e depois de cada evento de floor change

Com esses dados, podemos identificar a causa raiz real e fazer uma correcao cirurgica.

