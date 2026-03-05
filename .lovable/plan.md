

## Plano: Renderizar sprites reais na SpriteSidebar

### Causa raiz

O metodo `renderSingleSprite` usa `drawItem` que calcula o indice do sprite via formula complexa de patterns (`wx % patX`, `wy % patY`). Quando chamado com `wx=0, wy=0`, muitos itens resolvem para sprite ID 0 (vazio) porque o sprite visivel esta em outra combinacao de pattern. O canvas fica transparente e retorna `null`.

O viewer do ChatGPT funciona porque renderiza sprites **diretamente pelo ID do SPR**, sem passar pela logica de patterns do DAT.

### Solucao

Alterar `renderSingleSprite` em `src/lib/tibiaRelic/mapTileRenderer.ts`:

1. Manter a tentativa atual via `drawItem` (funciona para a maioria dos itens)
2. Se o canvas ficar vazio (nenhum pixel visivel), fazer **fallback**: pegar o primeiro `spriteId > 0` do array `def.spriteIds` e renderizar diretamente via `getSpriteCanvas`
3. Nunca retornar `null` se existir pelo menos um sprite valido no array

```text
Fluxo:
1. Tenta drawItem normal (com displacement, patterns, etc)
2. Verifica pixels → se tem pixels, retorna normalmente
3. Se vazio, percorre def.spriteIds e pega o primeiro sid > 0
4. Renderiza esse sprite diretamente no canvas 32x32 via getSpriteCanvas(sid)
5. Se nenhum spriteId valido existe, ai sim retorna null
```

### Arquivo a modificar
- `src/lib/tibiaRelic/mapTileRenderer.ts` — metodo `renderSingleSprite`

