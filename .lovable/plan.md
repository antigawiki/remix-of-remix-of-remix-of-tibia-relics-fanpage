

## Plano: Remover tiles estaticos e corrigir sprites em branco

### Problema 1: Arquivos de tiles estaticos (public/map/)

Os 16 arquivos `public/map/floor-XX-map.png` e `public/map/icon.png` nao sao referenciados em nenhum lugar do codigo. O mapa usa tiles do servidor externo (`st54085.ispot.cc`) como base e dados extraidos do banco como overlay. Esses arquivos podem ser deletados com seguranca.

**Arquivo a modificar:**
- Deletar todos os arquivos em `public/map/`

### Problema 2: Sprites em branco com X na SpriteSidebar

O fix anterior de displacement corrigiu o calculo de coordenadas, mas o problema real persiste: quando `renderSingleSprite` retorna um canvas **nao-nulo mas completamente transparente** (todos os sprite IDs do item resolvem para `null` no SPR), o `SpriteSidebar` nao mostra o placeholder — ele desenha o canvas vazio, que aparece como fundo branco.

**Causa raiz:** `renderSingleSprite` retorna o canvas mesmo quando nenhum pixel foi desenhado. O `SpriteSidebar` so mostra o placeholder (`drawEmptyPlaceholder`) quando `renderSingleSprite` retorna `null`.

**Correcao em `src/lib/tibiaRelic/mapTileRenderer.ts` — metodo `renderSingleSprite`:**
- Apos desenhar no canvas temporario, verificar se algum pixel tem alpha > 0
- Se o canvas estiver totalmente transparente, retornar `null` em vez do canvas vazio
- Isso garante que o placeholder e mostrado corretamente para items sem sprites validos

Logica:
```text
1. Desenha item no canvas temporario (como antes)
2. Lê os pixels do canvas com getImageData
3. Verifica se existe pelo menos 1 pixel com alpha > 0
4. Se nenhum pixel visivel → return null (placeholder sera exibido)
5. Se tem pixels → redimensiona para 32x32 e retorna
```

**Arquivo a modificar:**
- `src/lib/tibiaRelic/mapTileRenderer.ts` — adicionar verificacao de pixels vazios em `renderSingleSprite`

