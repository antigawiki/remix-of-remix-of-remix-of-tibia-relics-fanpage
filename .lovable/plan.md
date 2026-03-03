

## Fix: Seek Crash + Visual Corruption no WASM Player

### Dois problemas identificados

**1. Crash no seek** — `g_gamestate->Reset()` (linha 333 do web_player.cpp) nao esta protegido por try-catch. Quando o Reset interno falha (ex: estado corrompido), o WASM inteiro morre.

**2. Corrupcao visual (players atravessando muros no 8x)** — O try-catch atual envolve TODOS os eventos de um frame. Se o evento 3 de 5 falha, os eventos 4 e 5 sao pulados. Isso deixa o gamestate inconsistente: por exemplo, uma criatura foi removida do tile antigo mas nao colocada no novo. A correcao e mover o try-catch para envolver cada evento individualmente.

### Mudancas no arquivo `tibiarc-player/web_player.cpp`

**A) Seek — proteger Reset + catch por evento:**

```cpp
void seek(double ms) {
    if (!g_recording || !g_gamestate) return;
    auto target = std::chrono::milliseconds((int64_t)ms);

    if (target < g_currentTick) {
        try {
            g_gamestate->Reset();
        } catch (...) {
            // Reset failed — recreate gamestate from scratch
            g_gamestate = std::make_unique<Gamestate>(*g_version);
        }
        g_needle = g_recording->Frames.cbegin();
        g_currentTick = std::chrono::milliseconds::zero();
        FastForwardToPlayer();
    }

    while (g_needle != g_recording->Frames.cend() &&
           g_needle->Timestamp <= target) {
        for (auto &event : g_needle->Events) {
            try {
                event->Update(*g_gamestate);
            } catch (...) {
                // Skip individual bad event, continue with next
            }
        }
        g_needle = std::next(g_needle);
    }

    g_currentTick = target;
    g_gamestate->CurrentTick = target.count();
    RenderFrame();
}
```

**B) MainLoop — catch por evento (nao por frame):**

```cpp
while (g_needle != g_recording->Frames.cend() &&
       g_needle->Timestamp <= g_currentTick) {
    for (auto &event : g_needle->Events) {
        try {
            event->Update(*g_gamestate);
        } catch (...) {
            // Skip bad event
        }
    }
    g_needle = std::next(g_needle);
}
```

**C) FastForwardToPlayer — catch por evento:**

```cpp
while (!g_gamestate->Creatures.contains(g_gamestate->Player.Id) &&
       g_needle != g_recording->Frames.cend()) {
    for (auto &event : g_needle->Events) {
        try {
            event->Update(*g_gamestate);
        } catch (...) {
            // Skip bad event
        }
    }
    g_needle = std::next(g_needle);
}
```

### Resumo das mudancas

| Local | Antes | Depois |
|---|---|---|
| `seek()` — Reset | Sem protecao | try-catch + fallback para recriar Gamestate |
| `seek()` — loop de frames | try-catch por frame | try-catch por evento individual |
| `MainLoop()` — loop de frames | try-catch por frame | try-catch por evento individual |
| `FastForwardToPlayer()` | try-catch por frame | try-catch por evento individual |

### Apos a edicao

Voce precisara rodar o workflow **"Build tibiarc WASM Player"** no GitHub Actions para gerar os novos arquivos .wasm e .js e depois subir eles aqui.

