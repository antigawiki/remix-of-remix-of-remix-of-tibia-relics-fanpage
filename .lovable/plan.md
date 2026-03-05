

## Analise dos Problemas e Plano de Correcao

### Descobertas

**1. Os erros 404 no console NAO sao do SPR/DAT**
Todos os 404 sao requisicoes do LeafletJS tentando carregar tiles de mapa pre-renderizados de `https://st54085.ispot.cc/mapper/tibiarelic/...`. Esse servidor externo simplesmente nao tem esses tiles. Isso e o fallback do mapa online — completamente separado da renderizacao SPR/DAT.

**2. O diagnostico mostra que SPR e DAT estao sendo lidos corretamente**
- SPR: 10482 sprites, todos com offsets validos
- DAT: 5061 items, 0 quebrados, maxSpriteId=10482, 0 bytes restantes
- A verificacao cruzada confirma 0 items com sprites invalidos

**3. Os "brancos com X" na SpriteSidebar**
Quando `renderSingleSprite(itemId)` retorna `null`, o canvas fica vazio — sem nenhum feedback visual. Isso acontece quando os sprites de um item tem `size=0` no SPR (sprites genuinamente transparentes/vazios no Tibia — como objetos invisiveis). O leitor do Claude tambem mostra esses mesmos sprites vazios, confirmando que NAO e um bug de parsing — sao sprites que realmente nao tem pixels.

**4. Flags customizadas do TibiaRelic (0x50, 0xC8, 0xD0)**
A analise do Claude menciona essas flags, mas nossos logs mostram que o arquivo DAT atual NAO as contem (flags vao ate 0x1E). O parser termina com 0 bytes restantes. Mesmo assim, e prudente adiciona-las como protecao para futuras versoes do arquivo.

### Plano

**1. Suprimir os 404 do tile server** (`CamMapPage.tsx`)
- Adicionar `errorTile` transparente ao layer do Leaflet para silenciar os erros de tiles inexistentes no servidor externo

**2. Renderizar placeholder para sprites vazios** (`SpriteSidebar.tsx`)
- Quando `renderSingleSprite` retorna null, desenhar um icone sutil (fundo escuro com borda tracejada) em vez de deixar o canvas em branco — similar ao que o viewer do Claude faz para sprites vazios

**3. Adicionar flags customizadas ao DAT parser** (`datLoader.ts`)
- Flag 0x50: 1 byte de parametro
- Flag 0xC8: 1 byte de parametro  
- Flag 0xD0: sem parametro
- Manter 0x0A como esta (0 bytes) ja que o parse atual funciona perfeitamente (remaining=0)

### Arquivos a modificar
1. `src/components/cam-editor/SpriteSidebar.tsx` — placeholder visual para sprites vazios
2. `src/lib/tibiaRelic/datLoader.ts` — flags customizadas como protecao
3. `src/pages/CamMapPage.tsx` — suprimir 404 do tile layer

