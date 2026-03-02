
## Separar toggle de mensagens do toggle de nomes

### Problema
O botao de "esconder chat" atual desliga `DrawOverlay` por completo, o que remove mensagens de chat **E** nomes de criaturas/jogadores. O usuario quer esconder apenas as mensagens, mantendo os nomes visiveis.

### Solucao

A biblioteca tibiarc ja tem flags separadas no `Renderer::Options`:
- `SkipRenderingMessages` - mensagens de chat
- `SkipRenderingYellingMessages` - gritos
- `SkipRenderingPlayerNames` - nomes de jogadores
- `SkipRenderingNonPlayerNames` - nomes de criaturas/NPCs
- `SkipRenderingCreatureHealthBars` - barras de vida

### Mudancas

**1. `tibiarc-player/web_player.cpp`**
- Remover `g_show_overlay` global
- Adicionar `g_skip_messages` global (default false)
- Alterar `set_overlay(int)` para `set_skip_messages(int)` que seta `g_skip_messages`
- Em `RenderFrame()`: sempre chamar `DrawOverlay`, mas setar `options.SkipRenderingMessages = g_skip_messages` e `options.SkipRenderingYellingMessages = g_skip_messages` antes de renderizar
- Manter `DrawOverlay` sempre ativo para que nomes continuem aparecendo

**2. `src/components/TibiarcPlayer.tsx`**
- Trocar chamada `mod.ccall('set_overlay', ...)` por `mod.ccall('set_skip_messages', ...)`
- Inverter a logica: quando chat desligado, chamar `set_skip_messages(1)` (skip=true)
- Labels e icones ja estao corretos ("Esconder mensagens" / "Mostrar mensagens")

**3. Recompilar WASM**
- Apos editar o `.cpp`, o usuario precisara recompilar o WASM e fazer upload do novo `tibiarc_player.wasm`

### Resumo das alteracoes no C++

```text
// ANTES:
static bool g_show_overlay = true;
void set_overlay(int enabled) { g_show_overlay = (enabled != 0); }
if (g_show_overlay) { Renderer::DrawOverlay(options, *g_gamestate, outputCanvas); }

// DEPOIS:
static bool g_skip_messages = false;
void set_skip_messages(int skip) { g_skip_messages = (skip != 0); }
options.SkipRenderingMessages = g_skip_messages;
options.SkipRenderingYellingMessages = g_skip_messages;
Renderer::DrawOverlay(options, *g_gamestate, outputCanvas); // sempre chamado
```

### Nota
Apos editar `web_player.cpp`, voce precisara recompilar com Emscripten e fazer upload do novo `.wasm`. O Lovable pode editar o `.cpp` e o `.tsx`, mas a compilacao do WASM precisa ser feita externamente.
