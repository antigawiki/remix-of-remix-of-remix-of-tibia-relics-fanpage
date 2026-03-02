

## Fix: Crashes aos ~12 minutos + Reduzir tamanho dos nomes

### Problema 1: Crashes com "Uncaught 2409064"

Os numeros como `2409064`, `2409128` sao ponteiros de excecoes C++ no heap do WASM. Eles ocorrem porque `MainLoop()` e `RenderFrame()` nao tem `try-catch`. Quando um frame contem um pacote corrompido ou um sprite invalido, a excecao propaga para o JS e mata o loop principal do Emscripten. Apos isso, o player congela permanentemente.

**Solucao**: Envolver o corpo de `MainLoop()` e `RenderFrame()` em `try-catch(...)` para que frames problematicos sejam ignorados em vez de derrubar o player inteiro.

### Problema 2: Nomes muito grandes

O renderer do tibiarc desenha nomes de criaturas/jogadores com tamanho padrao. Para reduzir pela metade, precisamos adicionar uma flag `HalfSizeNames` no `Renderer::Options` e usa-la no codigo de renderizacao. Como alternativa mais simples que nao exige mudanca no renderer interno, podemos usar a resolucao de renderizacao -- mas isso afetaria tudo. A abordagem mais limpa e adicionar uma opcao dedicada.

Porem, como o renderer e uma biblioteca externa (tibiarc), a forma mais pratica e adicionar um campo no Options e passar para o DrawOverlay. Se o tibiarc nao suportar isso nativamente, a alternativa e renderizar em resolucao maior (ex: 960x704) para que os nomes fiquem proporcionalmente menores -- mas isso muda o visual geral.

**Abordagem recomendada**: Como os nomes sao desenhados pelo tibiarc internamente e nao temos controle direto sobre o tamanho da fonte via Options, vou propor usar `options.NameScale = 0.5` se existir, ou documentar que isso requer mudanca no renderer C++ do tibiarc.

### Mudancas no codigo

**1. `tibiarc-player/web_player.cpp` -- try-catch no MainLoop e RenderFrame**

```text
static void MainLoop() {
    if (!g_playing || !g_recording || !g_gamestate) return;

    try {
        double now = emscripten_get_now();
        double elapsed = (now - g_lastFrameTime) * g_speed;
        g_lastFrameTime = now;

        g_currentTick += std::chrono::milliseconds((int64_t)elapsed);
        g_gamestate->CurrentTick = g_currentTick.count();

        if (g_currentTick >= g_recording->Runtime) {
            g_playing = false;
            g_currentTick = g_recording->Runtime;
            return;
        }

        while (g_needle != g_recording->Frames.cend() &&
               g_needle->Timestamp <= g_currentTick) {
            try {
                for (auto &event : g_needle->Events) {
                    event->Update(*g_gamestate);
                }
            } catch (...) {
                // Skip corrupted frame, continue playback
            }
            g_needle = std::next(g_needle);
        }

        g_gamestate->Messages.Prune(g_currentTick.count());
        RenderFrame();
    } catch (...) {
        // Prevent any exception from killing the main loop
    }
}
```

E tambem no `RenderFrame`:

```text
static void RenderFrame() {
    if (!g_gamestate || !g_recording) return;
    try {
        // ... rendering code ...
    } catch (...) {
        // Skip this frame render on error
    }
}
```

**2. Nomes menores -- requer investigacao do tibiarc**

O tamanho dos nomes e controlado internamente pelo `Renderer::DrawOverlay` do tibiarc. As opcoes possiveis sao:

- Se `Renderer::Options` tiver um campo como `NameScale` ou `FontSize`, basta setar para metade
- Se nao tiver, sera necessario modificar o codigo do renderer do tibiarc para adicionar essa opcao
- Alternativa sem mudar o renderer: renderizar em resolucao maior (ex: 960x704) faz tudo ficar menor proporcionalmente, incluindo nomes -- mas tambem afeta o mapa e sprites

Recomendo que voce verifique se o `Renderer::Options` do tibiarc tem algum campo de escala de fonte. Se nao tiver, sera necessario adicionar no codigo-fonte do tibiarc (nao no web_player.cpp).

### Resumo

| Arquivo | Mudanca |
|---|---|
| `tibiarc-player/web_player.cpp` | try-catch em MainLoop (duplo: um no loop de eventos, outro geral) e try-catch em RenderFrame |
| tibiarc renderer (externo) | Investigar/adicionar opcao de escala de nomes |

### Nota

Apos editar o `.cpp`, voce precisara recompilar com Emscripten e fazer upload do novo `.wasm`.

