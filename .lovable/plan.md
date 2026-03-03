

## Fix: Erro de compilação do WASM

O erro do build é claro:

```
field designator 'SkipRenderingCreatureNames' does not refer to any field in type 'Renderer::Options'
```

O struct `Renderer::Options` do tibiarc **não tem** `SkipRenderingCreatureNames` nem `SkipRenderingCreatureIcons`. Além disso, os campos estão fora da ordem de declaração (warnings `-Wreorder-init-list`).

### Correção no `web_player.cpp`

Remover os campos inexistentes e reordenar para seguir a ordem do struct. Baseado nos erros, os campos válidos e sua ordem de declaração são:

1. `Width`
2. `Height`
3. `SkipRenderingMessages`
4. `SkipRenderingPlayerNames`
5. `SkipRenderingYellingMessages`
6. `SkipRenderingCreatureHealthBars`
7. `SkipRenderingStatusBars`

O bloco `Renderer::Options` deve ficar:

```cpp
Renderer::Options options{
    .Width = RENDER_WIDTH,
    .Height = RENDER_HEIGHT,
    .SkipRenderingMessages = g_skip_messages,
    .SkipRenderingPlayerNames = g_skip_messages,
    .SkipRenderingYellingMessages = g_skip_messages,
    .SkipRenderingCreatureHealthBars = false,
    .SkipRenderingStatusBars = g_skip_messages,
};
```

Isso remove `SkipRenderingCreatureNames` e `SkipRenderingCreatureIcons` (não existem), e reordena os campos para `PlayerNames` antes de `YellingMessages` (conforme a ordem de declaração indicada pelos warnings).

Após o commit, rodar o workflow novamente.

