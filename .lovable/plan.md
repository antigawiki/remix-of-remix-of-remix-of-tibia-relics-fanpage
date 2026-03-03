

## Problema

As mensagens continuam aparecendo porque o `Renderer::Options` do tibiarc tem **muitos** flags de skip, mas o `web_player.cpp` só usa dois:

```cpp
.SkipRenderingMessages = g_skip_messages,
.SkipRenderingYellingMessages = g_skip_messages
```

O tibiarc tem flags adicionais (visíveis na documentação CLI do projeto):
- `SkipRenderingPlayerNames`
- `SkipRenderingCreatureNames`
- `SkipRenderingCreatureHealthBars`
- `SkipRenderingCreatureIcons`
- `SkipRenderingStatusBars`
- `SkipRenderingIconBar`
- `SkipRenderingInventory`

Os textos no screenshot ("Resenha says:", "utevo lux", "You advanced to...", "Troooooot!") são renderizados por caminhos diferentes que não são cobertos só por `SkipRenderingMessages`.

## Solução

### 1. `web_player.cpp` — Mudar default e adicionar todos os flags

- Mudar `g_skip_messages` para `true` por default (mensagens ocultas ao iniciar)
- No `RenderFrame`, usar TODOS os flags de skip de texto/overlay quando `g_skip_messages = true`:

```cpp
static bool g_skip_messages = true;  // hidden by default

// In RenderFrame:
Renderer::Options options{
    .Width = RENDER_WIDTH,
    .Height = RENDER_HEIGHT,
    .SkipRenderingMessages = g_skip_messages,
    .SkipRenderingYellingMessages = g_skip_messages,
    .SkipRenderingPlayerNames = g_skip_messages,
    .SkipRenderingCreatureNames = false,      // keep creature names visible
    .SkipRenderingCreatureHealthBars = false,  // keep health bars
    .SkipRenderingCreatureIcons = false,       // keep icons
    .SkipRenderingStatusBars = g_skip_messages,
};
```

> **Nota:** Será necessário verificar quais campos exatamente existem no struct `Renderer::Options` do fork. Pode ser que nem todos existam na versão compilada. Compile apenas os que o compilador aceitar.

### 2. `web_player.cpp` — Título da janela SDL

Mudar o título do SDL_CreateWindow para evitar o flash "tibiarc":

```cpp
g_window = SDL_CreateWindow("Tibia Relic - Cam Player", ...);
```

### 3. Recompilar WASM

Após as alterações, disparar o workflow no GitHub Actions e fazer upload dos novos `.js` e `.wasm`.

### 4. `TibiarcPlayer.tsx` — Sync do default

Como o C++ agora inicia com `g_skip_messages = true`, o JS deve manter `overlayEnabled = false` (já está correto). Nenhuma mudança necessária no JS.

