

## Fix robusto: Tela preta no cam player apos frames corrompidos

### Diagnostico

O C++ `RenderFrame()` renderiza tela preta quando os tiles ao redor do player estao vazios. Isso acontece quando:
1. Um opcode `mapDesc` (0x64) ou `floorChange` (0xbe/0xbf) limpa tiles existentes
2. O parse do restante do pacote falha (buffer overflow, dados corrompidos)
3. Resultado: player existe, camera correta, mas zero tiles = tela preta com mensagens flutuando

### Problemas no fix atual

1. **`safeCall` engole excecoes**: O `try-catch` no `handleSeek` nunca dispara porque `safeCall` ja captura internamente. O fallback para `lastGoodProgressRef` e codigo morto.

2. **Playback continuo nao tem protecao**: O `MainLoop` do C++ processa frames corrompidos sem nenhuma recuperacao. Se o player chegar no minuto 59+ durante o play normal, o estado corrompe igualmente.

3. **O reload funciona em teoria**: Quando fazemos `reloadRecording` + `seek(48min)`, o C++ cria um gamestate novo e processa apenas frames 0-48min, nunca tocando os frames corrompidos. Isso DEVERIA funcionar.

### Solucao em 3 partes

#### Parte 1: Validacao pos-seek no C++ (via nova funcao exportada)

Adicionar uma funcao `validate_state()` ao `web_player.cpp` que retorna um status code:
- 0 = OK (player existe + tiles nao vazios ao redor)
- 1 = player creature nao existe
- 2 = tiles vazios ao redor do player

Entretanto, como nao podemos recompilar o WASM agora, usaremos uma abordagem JS-only.

#### Parte 2: Deteccao de corrupcao pos-seek (JS-only)

Apos cada seek, verificar se o canvas esta "vazio" (tela preta). Tecnica: ler pixels do canvas via `getImageData` e verificar se a maioria e preta. Se sim, o seek corrompeu o estado.

Mudanca em `handleSeek` no `TibiarcPlayer.tsx`:

```text
1. Reload recording (estado limpo)
2. Seek para posicao desejada
3. Aguardar 50ms para renderizar
4. Verificar canvas - se >95% pixels pretos:
   a. Tentar seek +5s (pular area problematica)
   b. Se ainda preto, seek +15s
   c. Se ainda preto, restaurar lastGoodProgress
5. Retomar playback
```

#### Parte 3: Protecao durante playback continuo

Adicionar ao polling de progresso (que roda a cada 100ms) uma verificacao do canvas. Se detectar tela preta durante playback:
1. Pausar
2. Reload recording
3. Seek para posicao atual + 5s (pular a area problematica)
4. Retomar playback

Isso cria um "auto-skip" que pula automaticamente areas corrompidas da .cam.

### Mudancas tecnicas

**Arquivo: `src/components/TibiarcPlayer.tsx`**

1. Nova funcao `isCanvasBlack()`:
   - Usa `canvasRef.current.getContext('2d').getImageData()`
   - Amostra ~100 pixels em grid para performance
   - Retorna true se >90% sao pretos (RGBA ~0,0,0)

2. Atualizar `handleSeek`:
   - Remover o try-catch inutilmorto (safeCall ja engole excecoes)
   - Apos seek + pequeno delay, verificar canvas
   - Se preto: tentar offsets crescentes (+5s, +15s, +30s)
   - Log de warning quando skip ocorre

3. Atualizar polling de progresso (useEffect do `state === 'playing'`):
   - A cada 2s (nao 100ms para nao impactar performance), verificar canvas
   - Se preto por 2 checks consecutivos: auto-skip +5s
   - Mostrar toast/log informando que area problematica foi pulada

### Limitacoes

- A deteccao por pixels tem um delay de ~50ms apos o seek
- Areas legitivamente escuras do jogo (cavernas totalmente negras) podem triggerar false positives - mitigado verificando se ha QUALQUER pixel nao-preto (ate cavernas tem tiles com cor)
- Nao resolve a causa raiz no WASM (precisaria recompilar) mas contorna efetivamente

