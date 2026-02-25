
# Floor Override no Cam Player

Adicionar controles de andar (floor) no player para permitir visualizar floors acima/abaixo do que a camera original mostra.

## Como funciona

- Um estado `floorOffset` (default 0) sera adicionado ao `TibiarcPlayer`
- O `Renderer` ganhara uma propriedade publica `floorOverride: number | null`
- Quando `floorOverride` nao for null, o renderer usa esse valor em vez de `gs.camZ` para calcular floors visiveis e posicionar a viewport
- Botoes de seta cima/baixo ao lado dos controles permitem ajustar o offset (-7 a +8 relative ao z atual)
- Um badge mostra o floor atual (ex: "Floor 7" ou "Floor 8 (+1)")
- Botao de reset volta ao floor original (offset 0)

## Arquivos alterados

### `src/lib/tibiaRelic/renderer.ts`
- Adicionar propriedade `floorOverride: number | null = null`
- No metodo `draw`, usar `floorOverride ?? g.camZ` como z de referencia para `getVisibleFloors` e calculo de offset/viewport

### `src/components/TibiarcPlayer.tsx`
- Adicionar estado `floorOffset` (number, default 0)
- Passar `floorOverride` ao renderer quando offset != 0: `gs.camZ + floorOffset`
- Adicionar na barra de controles: botoes ChevronUp/ChevronDown para ajustar offset, badge com floor atual, botao reset
- Limitar offset para manter z resultante entre 0 e 15
- Resetar offset ao carregar novo arquivo ou ao fazer reset de playback
