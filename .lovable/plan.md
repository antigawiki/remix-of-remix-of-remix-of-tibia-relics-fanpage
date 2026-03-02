

## Fix: Player travando apos ~1 hora de reproducao

### Causa raiz provavel

Em `RenderFrame()`, duas instancias de `Canvas` sao criadas e destruidas a cada frame:

```text
static void RenderFrame() {
    Canvas mapCanvas(RENDER_WIDTH, RENDER_HEIGHT);   // alloc ~675KB
    // ...
    Canvas outputCanvas(RENDER_WIDTH, RENDER_HEIGHT); // alloc ~675KB
    // pixel copy loop
    // ...
}  // ambas destruidas aqui
```

A 60fps durante 1 hora, sao ~216.000 ciclos de malloc/free por canvas, totalizando ~432.000 alocacoes. No heap linear do WASM (que nao tem compactacao), isso causa fragmentacao severa ate esgotar a memoria disponivel e travar.

Alem disso, o loop de copia pixel-a-pixel entre as duas canvas e desnecessario -- pode-se desenhar o gamestate e o overlay na mesma canvas sequencialmente.

### Solucao

**1. `tibiarc-player/web_player.cpp` -- Canvas estaticos**

Mover as duas canvas para variaveis globais estaticas, alocadas uma unica vez:

```text
// ANTES (em cada frame):
Canvas mapCanvas(480, 352);
Canvas outputCanvas(480, 352);

// DEPOIS (globais, alocados uma vez):
static Canvas* g_mapCanvas = nullptr;
static Canvas* g_outputCanvas = nullptr;

// Em main(), apos criar o SDL:
g_mapCanvas = new Canvas(RENDER_WIDTH, RENDER_HEIGHT);
g_outputCanvas = new Canvas(RENDER_WIDTH, RENDER_HEIGHT);
```

Em `RenderFrame()`, reutilizar os buffers existentes limpando com `DrawRectangle` no inicio (como ja faz) em vez de realocar.

**2. Simplificar RenderFrame**

Remover o loop de copia pixel-a-pixel. Renderizar o gamestate em `g_mapCanvas`, copiar o buffer de uma vez (memcpy) para `g_outputCanvas`, e entao desenhar o overlay em `g_outputCanvas`. Ou melhor ainda: usar um unico canvas -- desenhar gamestate primeiro, depois overlay em cima.

```text
static void RenderFrame() {
    if (!g_gamestate || !g_recording) return;
    
    Renderer::Options options{ ... };
    
    // Limpa o canvas
    g_mapCanvas->DrawRectangle(Pixel(0,0,0), 0, 0, RENDER_WIDTH, RENDER_HEIGHT);
    
    // Gamestate + Overlay no mesmo buffer
    Renderer::DrawGamestate(options, *g_gamestate, *g_mapCanvas);
    
    // Copiar para output canvas para overlay (se necessario manter separacao)
    memcpy(g_outputCanvas->Buffer, g_mapCanvas->Buffer, 
           RENDER_HEIGHT * g_mapCanvas->Stride);
    
    Renderer::DrawOverlay(options, *g_gamestate, *g_outputCanvas);
    
    SDL_UpdateTexture(g_texture, nullptr, g_outputCanvas->Buffer, 
                      g_outputCanvas->Stride);
    SDL_RenderClear(g_renderer);
    SDL_RenderCopy(g_renderer, g_texture, nullptr, nullptr);
    SDL_RenderPresent(g_renderer);
}
```

**3. Protecao extra: Messages.Prune**

Confirmar que `Messages.Prune()` esta sendo chamado no `MainLoop` (ja esta). Sem isso, a lista de mensagens cresceria indefinidamente.

### Resumo das mudancas

| Arquivo | Mudanca |
|---|---|
| `tibiarc-player/web_player.cpp` | Canvas globais estaticos em vez de alocacao por frame; memcpy em vez de loop pixel-a-pixel |

### Nota

Apos editar o `.cpp`, voce precisara recompilar com Emscripten e fazer upload do novo `.wasm`. O Lovable edita o `.cpp` mas a compilacao do WASM e feita externamente.

