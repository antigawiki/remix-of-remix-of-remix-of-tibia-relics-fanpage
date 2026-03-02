

## Corrigir cores rosadas e posição da câmera no player WASM

### Problema 1: Tela rosada (canais R e B trocados)

O `Pixel` struct do tibiarc armazena bytes na memória como: `R, G, B, A` (nessa ordem).

O SDL texture usa `SDL_PIXELFORMAT_RGBA8888`, que em sistemas little-endian (como WASM) espera bytes na memória como `A, B, G, R` -- ou seja, inverte a ordem. Resultado: R e B ficam trocados, gerando o tom rosa/magenta.

**Correção**: Trocar para `SDL_PIXELFORMAT_ABGR8888`, que em little-endian espera bytes na memória como `R, G, B, A` -- exatamente o que o Pixel struct produz.

### Problema 2: Câmera deslocada

O código atual usa:
```cpp
Renderer::Options options{
    .Width = RENDER_WIDTH,          // 640
    .Height = RENDER_HEIGHT - 128   // 352
};
```

O `NativeResolutionX` do tibiarc é **480** e `NativeResolutionY` é **352**. O map canvas é criado com essas dimensões nativas (480x352), mas o Options.Width é 640 -- causando desalinhamento entre a área renderizada e o canvas.

**Correção**: Usar as constantes nativas do Renderer para o Options e o canvas, depois copiar para o output canvas com escala ou posicionamento correto:

```text
Options.Width  = Renderer::NativeResolutionX  (480)
Options.Height = Renderer::NativeResolutionY  (352)
```

### Mudanças no arquivo

**`tibiarc-player/web_player.cpp`**:

1. **Linha 422**: Trocar `SDL_PIXELFORMAT_RGBA8888` por `SDL_PIXELFORMAT_ABGR8888`
2. **Linhas 355-358**: Corrigir Options para usar as dimensões nativas do Renderer:
   ```cpp
   Renderer::Options options{
       .Width = Renderer::NativeResolutionX,
       .Height = Renderer::NativeResolutionY
   };
   ```

### Resultado esperado

- Cores corretas (sem tom rosa)
- Câmera centralizada na posição correta do jogador
- O WASM precisará ser **recompilado** via GitHub Actions após essas mudanças

