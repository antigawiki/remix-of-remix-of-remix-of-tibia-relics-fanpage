

## Plano: Capturar Tiles Multi-Floor e Destacar Buracos Especiais

### Problemas Identificados

1. **Filtro de viewport muito restritivo**: O filtro `tz !== camZ` descarta todos os tiles de andares diferentes. Porem o servidor Tibia envia dados de multiplos andares simultaneamente (floors z-2 a z+2 no subsolo, ou 7 a 0 na superficie). Esses tiles sao dados reais e valiosos -- incluindo locais que o jogador nunca visitou fisicamente.

2. **Filtro de distancia remove tiles distantes**: O check `Math.abs(tx - camX) > 20` impede a captura de tiles que o servidor envia alem da viewport. Em servidores customizados como TibiaRelic, e possivel que o servidor envie informacao extra.

3. **Tiles especiais nao sao destacados**: Rope holes (tiles com circulo marrom onde se usa corda) e shovel spots (chao do deserto que esconde buracos) tem IDs de item especificos no Tibia.dat que podem ser identificados e destacados visualmente.

### Sobre os IDs Especiais (Rope Holes e Shovel Spots)

No Tibia 7.x, esses tiles tem item IDs especificos:
- **Rope hole**: Tipicamente item 384 (ground tile com circulo marrom). E um item de chao (stackPrio 0) com sprite distinto.
- **Shovel spot**: Tipicamente item 606 (loose stone pile no deserto). Sim, tem ID diferente do chao comum -- e um item separado empilhado sobre o ground tile do deserto. Quando o jogador usa shovel nele, o servidor troca por um tile de buraco.

Como os IDs podem variar no TibiaRelic, a abordagem ideal e: identificar esses IDs empiricamente verificando os sprites no DatLoader, e adicionar uma lista configuravel no renderer.

---

### Solucao

#### 1. Relaxar filtro de andar no MapExtractor (`mapExtractor.ts`)

Remover a restricao `tz !== camZ` para capturar tiles de todos os andares que o servidor envia. Manter apenas:
- Validacao de coordenadas do mundo (30000-35000)
- Filtro de coordenadas zero
- Filtro de item ID valido

Tambem remover o filtro de distancia da camera (`Math.abs > 20`), ja que os dados sao enviados pelo servidor e sao confiaveis.

Para criaturas, manter o filtro de distancia (criaturas distantes podem ser stale data no GameState).

#### 2. Destacar tiles especiais no MapTileRenderer (`mapTileRenderer.ts`)

Adicionar deteccao de item IDs especiais durante o rendering:
- **Rope holes**: Desenhar um overlay colorido (borda verde ou icone) sobre tiles que contem o item de rope hole
- **Shovel spots**: Desenhar um overlay diferente (borda amarela ou icone de pa) sobre tiles que contem o item de shovel spot

Criar uma lista de IDs especiais configuravel. Para descobrir os IDs corretos no TibiaRelic, adicionar um log temporario que imprime os sprite IDs dos items de chao encontrados, permitindo identificar visualmente os tiles especiais.

#### 3. Ferramenta de investigacao de IDs (bonus)

Adicionar um tooltip no CamMapPage que, ao passar o mouse sobre um tile, mostra os item IDs presentes naquela posicao. Isso facilita a identificacao de IDs de tiles especiais como rope holes e shovel spots.

---

### Arquivos Modificados

1. **`src/lib/tibiaRelic/mapExtractor.ts`**
   - `snapshotTilesWithCounts`: Remover `tz !== camZ` e o filtro de distancia da camera
   - Manter filtro de coordenadas validas (30000-35000) e zeros

2. **`src/lib/tibiaRelic/mapTileRenderer.ts`**
   - Adicionar constante `SPECIAL_TILES` com IDs de rope holes e shovel spots (inicialmente com IDs comuns do Tibia 7.x: 384, 469, 470, 482, 484 para rope; 606, 593 para shovel)
   - No `renderChunk`, apos desenhar os items do tile, verificar se algum ID e especial e desenhar overlay colorido

3. **`src/pages/CamMapPage.tsx`**
   - Adicionar tooltip com item IDs ao passar mouse sobre tiles (usando dados em memoria do floorDataRef)
   - Exibir legenda dos highlights especiais

### Observacao

Sera necessario re-extrair as .cam apos essa mudanca para capturar os tiles de outros andares que antes eram descartados. Os IDs especiais podem precisar de ajuste apos investigacao visual.

