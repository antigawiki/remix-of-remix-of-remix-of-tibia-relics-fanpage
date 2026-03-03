

## Diagnostico e Correcoes do Parser JS

### Analise dos dados

O JSON mostra um padrao claro: **quase todas** as anomalias reportam opcode `109` (0x6d = moveCr), mesmo quando ha mudanca de andar (Z). Isso revela **dois problemas distintos**:

### Problema 1: Analyzer reporta opcodes errados (falso diagnostico)

A funcao `extractOpcodes` no `camAnalyzer.ts` e simplificada demais: no modo direto, so captura o **primeiro byte** do frame. Mas um frame pode conter multiplos opcodes (ex: `floorUp` + `moveCr` + `scroll`). O analyzer mostra "opcode 109" quando na verdade houve um `floorUp` (0xBE) seguido de `moveCr` no mesmo frame.

**Correcao**: Instrumentar o `PacketParser` para registrar todos os opcodes processados. Adicionar um array `lastFrameOpcodes` que o `dispatch()` popula a cada opcode. O analyzer le esse array apos cada `parser.process()`.

### Problema 2: `floorUp`/`floorDown` nao sincronizam o player (bug real do parser)

Este e o bug principal que causa saltos no cam player. Olhando o codigo:

```text
floorUp():
  g.camZ--
  readFloorArea(...)
  g.camX++; g.camY++   // perspective offset
  cleanupDistantCreatures()
  reinsertCreaturesOnTiles()
  // ← NÃO chama syncPlayerToCamera!
```

Apos `floorUp`, a camera muda de andar e posicao, mas o player creature fica com as coordenadas antigas. Resultado: DESYNC (camera Z=5, player Z=6). Os scrolls seguintes nao corrigem porque o guard `Math.abs(player.x - g.camX) + Math.abs(player.y - g.camY) <= 1` falha (distancia = 2 por causa do perspective offset).

**Correcao em `floorUp`**: chamar `syncPlayerToCamera(oldZ)` apos o offset de perspectiva.
**Correcao em `floorDown`**: idem.
**Correcao no `scroll` guard**: relaxar para `<= 2` para acomodar o offset de perspectiva pos-floor change.

### Mudancas por arquivo

**`src/lib/tibiaRelic/packetParser.ts`**:
- Adicionar `public lastFrameOpcodes: number[] = []` ao PacketParser
- No `dispatch()`, fazer `this.lastFrameOpcodes.push(t)` para registrar todo opcode processado
- No `process()`, limpar o array no inicio: `this.lastFrameOpcodes = []`
- Em `floorUp()` (linha 731-757): adicionar `this.syncPlayerToCamera(oldZ)` apos `g.camX++; g.camY++`
- Em `floorDown()` (linha 759-786): adicionar `this.syncPlayerToCamera(oldZ)` apos `g.camX--; g.camY--`
- No `scroll()` (linha 472): mudar guard de `<= 1` para `<= 2`

**`src/lib/tibiaRelic/camAnalyzer.ts`**:
- Remover a funcao `extractOpcodes` simplificada
- Usar `parser.lastFrameOpcodes` apos cada `parser.process(frame.payload)` para obter os opcodes reais
- Isso elimina falsos positivos e mostra os opcodes corretos na analise

### Impacto esperado

- **Cam player**: floor changes (escadas, rampas) nao causarao mais DESYNC entre camera e player
- **Analyzer**: mostrara os opcodes reais, permitindo diagnosticar problemas restantes com precisao
- **Scroll pos-floor**: player acompanhara a camera corretamente apos mudar de andar

