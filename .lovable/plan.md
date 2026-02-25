

# Fix: Outfits transparentes de criaturas

## Causa raiz

O problema esta no `sprLoader.ts`, linhas 36-37 e 56:

```text
// Le 3 bytes como "chroma key"
const ckR = raw[off], ckG = raw[off + 1], ckB = raw[off + 2];
...
// Filtra pixels que coincidem com o chroma key - tornando-os transparentes
if (r !== ckR || g !== ckG || b !== ckB) {
  px[i] = r; px[i+1] = g; px[i+2] = b; px[i+3] = 255;
}
```

No formato .spr do Tibia 7.x, a transparencia ja e tratada pela codificacao RLE: cada bloco comeca com `u16 transparent_pixels` (pixels a pular) seguido de `u16 colored_pixels` (pixels opacos). Os 3 bytes iniciais do sprite (chamados "color key") sao um legado que nao deve ser usado para filtrar -- todos os pixels na secao "colored" sao opacos por definicao.

Quando o "chroma key" coincide com alguma cor presente no sprite (ex: preto 0,0,0 ou outra cor comum), esses pixels sao erroneamente tornados transparentes, causando o efeito "fantasma" em todas as criaturas.

## Correcao

### `src/lib/tibiaRelic/sprLoader.ts`
- Remover a comparacao de chroma key no loop de pixels
- Todos os pixels da secao "colored" do RLE devem receber alpha=255 incondicionalmente
- Manter a leitura dos 3 bytes do offset (para manter o ponteiro correto), mas nao usa-los para filtrar

### `src/lib/tibiaRelic/renderer.ts`
- Corrigir o cache key do tint: `getSpriteCanvasKey` retorna `32x32` para TODOS os sprites, fazendo o cache de tint retornar o mesmo resultado para masks diferentes. Usar o sprite ID em vez das dimensoes do canvas.

## Arquivos alterados
- `src/lib/tibiaRelic/sprLoader.ts` (remover filtro chroma key)
- `src/lib/tibiaRelic/renderer.ts` (corrigir tint cache key)

