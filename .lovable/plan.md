

## Correcao: Titulo "tibiarc" na aba e imagem desalinhada

### Problemas

1. **Titulo da aba mostra "tibiarc"**: O JavaScript compilado pelo Emscripten (`tibiarc_player.js`) define automaticamente `document.title = "tibiarc"`. Isso sobrescreve o titulo da pagina.

2. **Imagem fora do lugar / bordas cinzas**: O canvas esta configurado como `640x480` (4:3), mas o WASM renderiza na resolucao nativa de `480x352`. A area renderizada nao preenche o canvas, criando bordas cinzas.

### Mudancas

**`src/components/TibiarcPlayer.tsx`**

1. Apos inicializar o modulo WASM, restaurar o titulo da pagina para "Tibia Relic Wiki":
```typescript
// Depois de: moduleRef.current = mod;
document.title = 'Tibia Relic Wiki';
```

2. Alterar as dimensoes do canvas de `640x480` para `480x352` para corresponder a resolucao nativa do WASM:
```html
<canvas width={480} height={352} ... />
```

3. Alterar o aspect ratio do container de `aspect-[4/3]` para a proporcao correta `480:352` (aproximadamente `30:22` ou `aspect-[480/352]`):
```html
<div className="... aspect-[480/352] ..." />
```

4. Adicionar um `useEffect` que restaura o titulo sempre que o Emscripten tentar muda-lo (usando MutationObserver no `<title>` ou simplesmente re-setando apos cada operacao WASM).

