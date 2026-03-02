

## Ajustar o video WASM para preencher o container

### Problema
O canvas esta fixo em 480x352 mas o WASM v7 renderiza em uma resolucao maior que inclui a area de jogo + painel inferior (com texto "Your last visit in Tibia Relic..."). O conteudo renderizado nao preenche o container, ficando reduzido.

### Solucao
Aumentar a resolucao do canvas para corresponder ao que o WASM v7 realmente renderiza. Pela imagem enviada, a proporcao e aproximadamente 960x704 (ou 480x352 escalado 2x). Tambem remover a restricao de `imageRendering: 'auto'` e usar `pixelated` para manter a nitidez dos pixels do jogo.

### Mudancas

**`src/components/TibiarcPlayer.tsx`**

1. Alterar as dimensoes do canvas para 960x704 (2x da resolucao nativa) que e o que o WASM v7 espera:
```html
<canvas width={960} height={704} />
```

2. Atualizar o aspect ratio do container para corresponder:
```html
<div className="aspect-[960/704] ...">
```

3. Usar `imageRendering: 'pixelated'` para manter a nitidez dos pixels do jogo ao escalar.

Se 960x704 nao for a resolucao correta, sera necessario testar com outras resolucoes comuns do Tibia (como 960x672, 800x600, etc.) ate encontrar a que elimina as bordas pretas.

