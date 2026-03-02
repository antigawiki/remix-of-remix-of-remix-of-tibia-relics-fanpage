

## Correcoes no Cam Player: Crashes, Fullscreen e Auto-play

### 1. Crashes "Uncaught 2409064" -- Fix no lado JS

O `try-catch` no C++ nao esta funcionando porque provavelmente as excecoes C++ nao estao habilitadas no build do Emscripten (flag `-fno-exceptions` ou ausencia de `-fwasm-exceptions`). Os numeros sao ponteiros de excecao do WASM que propagam para o JS como erros nao tratados.

**Solucao**: Envolver TODAS as chamadas `ccall` no JavaScript com `try-catch`. Isso inclui:
- O polling de progresso (`get_progress`, `is_playing`) no `setInterval`
- O handler de `visibilitychange` (`pause_playback`, `play`)
- O `togglePlayback`, `cycleSpeed`, `handleSeek`
- Os callbacks de overlay e fullscreen

Isso garante que mesmo que o WASM lance uma excecao, o player continua funcionando.

### 2. Fullscreen com proporcao e controles sobrepostos

Atualmente o fullscreen apenas estica o container. Baseado na imagem de referencia, o comportamento ideal e:
- Fundo preto preenchendo toda a tela
- Canvas centralizado mantendo a proporcao 480:352
- Controles (play, skip, speed, mensagens, fullscreen) sobrepostos na parte inferior do canvas, como uma barra semi-transparente
- Barra de progresso tambem inclusa no overlay
- Controles aparecem ao passar o mouse e somem apos alguns segundos

**Mudancas**:
- Mover o `containerRef` para envolver tanto o canvas quanto os controles
- Adicionar classes condicionais quando `isFullscreen` esta ativo: fundo preto, canvas com `object-contain`, controles posicionados absolutamente na parte inferior
- Usar CSS `aspect-ratio` e `max-height: 100vh` / `max-width: 100vw` para manter proporcao

### 3. Auto-play ao selecionar arquivo

Apos o carregamento bem-sucedido de um `.cam`, em vez de ir para `paused`, chamar `play()` e setar estado para `playing` automaticamente.

**Mudanca**: No `handleFileSelect`, apos setar `duration` e `progress`, chamar `mod.ccall('play')` e `setState('playing')` em vez de `setState('paused')`.

### Detalhes tecnicos -- Arquivo: `src/components/TibiarcPlayer.tsx`

| Mudanca | Descricao |
|---|---|
| Try-catch em ccall | Envolver todos os `mod.ccall(...)` em blocos try-catch para evitar que excecoes WASM matem o player |
| Fullscreen layout | Reestruturar JSX para que em fullscreen: container ocupe tela toda com bg preto, canvas centralizado com aspect-ratio, controles sobrepostos em barra na parte inferior |
| Auto-play | Apos `load_recording_tibiarelic` sucesso, chamar `play()` e setar estado `playing` |
| Ocultar controles | Em fullscreen, mostrar controles ao mover o mouse, esconder apos 3s de inatividade |

### Estrutura do fullscreen

```text
+------------------------------------------+
|                                          |
|            (fundo preto)                 |
|                                          |
|     +----------------------------+       |
|     |                            |       |
|     |    Canvas 480:352          |       |
|     |    (centralizado)          |       |
|     |                            |       |
|     +----------------------------+       |
|     | [>] [|<] [>|] [>>1x] [msg] [fs]|  |
|     | |====progress bar=========|    |   |
|     +----------------------------+       |
|                                          |
+------------------------------------------+
```

