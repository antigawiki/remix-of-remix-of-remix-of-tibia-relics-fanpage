

## Corrigir viewport do player (bordas cinzas e desalinhamento)

### Problema

Na correção anterior, mudamos `Options.Width` de `RENDER_WIDTH` (640) para `Renderer::NativeResolutionX` (480). Isso fez o mapa ser renderizado em 480x352, mas o output canvas e a textura SDL continuam em 640x480. Resultado:
- O mapa ocupa apenas 480 dos 640 pixels de largura, gerando bordas cinzas
- O overlay (nomes, barras de vida) é posicionado para um viewport de 480px mas desenhado no canvas de 640px, desalinhando os nomes das criaturas

### Causa

O `Renderer::DrawGamestate` calcula as posicoes dos tiles baseado em `Options.Width`. Se Width=480, o mapa e centralizado nessa largura. Mas o `DrawOverlay` desenha nomes e barras no `outputCanvas` (640x480), e o SDL escala tudo para o canvas HTML. O resultado e que o mapa fica comprimido/deslocado em relacao aos nomes.

### Correcao

Reverter `Options.Width` para `RENDER_WIDTH` (640) e o `mapCanvas` tambem para 640. Manter `Options.Height` em 352 (`RENDER_HEIGHT - 128`), que ja estava correto antes. Manter a correcao do pixel format `ABGR8888`.

### Mudancas

**`tibiarc-player/web_player.cpp`** - Linhas 355-363:

```cpp
// DE (atual - quebrado):
Renderer::Options options{
    .Width = Renderer::NativeResolutionX,   // 480
    .Height = Renderer::NativeResolutionY   // 352
};
Canvas mapCanvas(Renderer::NativeResolutionX, Renderer::NativeResolutionY);
mapCanvas.DrawRectangle(Pixel(0,0,0), 0, 0,
                        Renderer::NativeResolutionX,
                        Renderer::NativeResolutionY);

// PARA (corrigido):
Renderer::Options options{
    .Width = RENDER_WIDTH,              // 640
    .Height = RENDER_HEIGHT - 128       // 352
};
Canvas mapCanvas(RENDER_WIDTH, RENDER_HEIGHT - 128);
mapCanvas.DrawRectangle(Pixel(0,0,0), 0, 0,
                        RENDER_WIDTH, RENDER_HEIGHT - 128);
```

Isso restaura as dimensoes de renderizacao do mapa para 640x352 (como era antes), eliminando as bordas cinzas e realinhando os nomes com os sprites. A unica mudanca que permanece da v6 e o pixel format `ABGR8888` (correcao das cores).

### Proximo passo

Apos a mudanca, sera necessario recompilar o WASM via GitHub Actions para gerar a versao **v7**.

