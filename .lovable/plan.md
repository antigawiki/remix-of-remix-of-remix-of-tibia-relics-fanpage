

## Diagnóstico: Mensagens acumulando durante seek/playback

### O problema

Olhando o `web_player.cpp`, a função `seek()` reproduz todos os frames do início até o ponto desejado, mas **nunca limpa as mensagens acumuladas**. Cada frame processado adiciona mensagens (chat, sistema, loot) ao `g_gamestate->Messages`, e no final do seek, centenas de mensagens de diferentes momentos da gravação ficam empilhadas na tela.

```text
seek(60000ms)
  → replay frame 0..600 (cada um adiciona mensagens)
  → DeduplicateCreatures() ✓
  → Messages.Prune() ✗  ← FALTANDO
  → RenderFrame() → desenha TODAS as mensagens acumuladas
```

O `MainLoop()` faz `Messages.Prune(currentTick)` a cada tick, mas o `seek()` não faz. E mesmo durante playback normal em velocidade alta (2x, 4x, 8x), as mensagens se acumulam mais rápido do que são removidas.

### Solução

Adicionar `g_gamestate->Messages.Prune(g_currentTick.count())` na função `seek()` do `web_player.cpp`, logo após processar todos os frames e antes de renderizar. Isso garante que apenas mensagens relevantes ao momento atual sejam exibidas.

### Mudanças

| Arquivo | O que fazer |
|---------|------------|
| `tibiarc-player/web_player.cpp` | Adicionar `Messages.Prune()` na função `seek()` antes de `RenderFrame()` |
| `.github/workflows/build-tibiarc.yml` | Nenhuma mudança necessária — o fix é no source |

### Detalhe da mudança

Na função `seek()`, após o loop de replay e antes de `DeduplicateCreatures()`:

```cpp
// Prune all messages older than current tick to prevent accumulation
g_gamestate->Messages.Prune(g_currentTick.count());
```

Após o rebuild do WASM, as mensagens serão limpas corretamente ao dar seek, e apenas mensagens do momento atual aparecerão.

