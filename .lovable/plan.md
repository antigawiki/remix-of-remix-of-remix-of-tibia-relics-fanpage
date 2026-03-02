

## Toggle de Overlay (Mensagens/Textos) no Player

### O que acontece hoje
As mensagens de chat, nomes de criaturas, textos animados e notificacoes do sistema sao renderizadas pelo `Renderer::DrawOverlay` dentro do WASM. O tibiarc ja faz pruning das mensagens (`Messages.Prune`), mas em gravacoes com muita atividade (areas movimentadas, muitos players falando), os textos se acumulam e poluem a tela.

### Solucao
Adicionar um **toggle on/off** para o overlay de textos, controlavel pelo usuario via um botao na interface do player.

### Mudancas

**1. `tibiarc-player/web_player.cpp`**
- Adicionar variavel global `g_show_overlay = true`
- Adicionar funcao exportada `set_overlay(int enabled)` chamavel via JS
- Na funcao `RenderFrame()`, condicionar a chamada `Renderer::DrawOverlay()` ao valor de `g_show_overlay`

```cpp
static bool g_show_overlay = true;

// Nova funcao exportada
EMSCRIPTEN_KEEPALIVE
void set_overlay(int enabled) {
    g_show_overlay = (enabled != 0);
}

// Em RenderFrame(), mudar para:
if (g_show_overlay) {
    Renderer::DrawOverlay(options, *g_gamestate, outputCanvas);
}
```

**2. `src/components/TibiarcPlayer.tsx`**
- Adicionar botao de toggle "Overlay" na barra de controles do player (ao lado dos botoes de velocidade)
- Chamar `Module._set_overlay(value)` via WASM quando o toggle mudar
- Icone: `MessageSquareOff` / `MessageSquare` do lucide-react
- Estado padrao: overlay ligado (on)

### Apos as mudancas de codigo
Voce precisara recompilar o WASM (v10) pelo GitHub Actions workflow e fazer upload dos novos arquivos `.js` e `.wasm`.

