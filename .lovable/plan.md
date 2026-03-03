

## Analise Completa: O que esta quebrando o Cam Map

### O que ja temos de protecao (e funciona)

1. **`tz !== camZ`** (linha 388) — So captura tiles do andar atual da camera. Tiles de outros andares no GameState tem Z diferente e sao ignorados.
2. **`gs.tiles.clear()`** (linha 97) — Limpa todos os tiles quando muda de andar, evitando residuos.
3. **Viewport radius 40** (linha 394) — So captura tiles perto da camera.

Essas 3 protecoes sao suficientes para garantir integridade de dados. O parser armazena tiles com Z correto (o Z vem do parametro `nz` no `readFloorArea`, nao do payload).

### O que esta causando os problemas

**Filtro `SURFACE_ONLY_ITEMS`** — Remove item IDs arbitrarios em andares subterraneos. Qualquer item que apareca tanto na superficie quanto no subsolo e removido, criando buracos no mapa.

**Filtro `hasGround` (stackPrio === 0)** — Rejeita tiles underground inteiros se nenhum item tiver stackPrio 0 no arquivo .dat. Tiles com ground items que o dat classifica com stackPrio diferente de 0 sao descartados, causando as areas vazias massivas que voce viu no screenshot.

**`floorStableBatches >= 3`** — Apos cada mudanca de andar, o extractor ignora 1500 frames de dados (3 batches x 500 frames). Em gravacoes onde o jogador muda de andar frequentemente, isso descarta uma parcela significativa dos tiles validos.

### Solucao: Remover filtros desnecessarios, confiar na logica base

A abordagem correta e simples: confiar no `tz !== camZ` + `gs.tiles.clear()` e remover toda filtragem extra por item ID.

#### Mudancas em `src/lib/tibiaRelic/mapExtractor.ts`:

**1. Remover `SURFACE_ONLY_ITEMS` completamente**

Deletar a constante e todo o bloco `if (camZ >= 8)` dentro de `snapshotTiles`. Nenhum filtro por item ID. O `tz !== camZ` ja garante que so tiles do andar correto sao capturados.

**2. Reverter `floorStableBatches` de 3 para 1**

Manter apenas 1 batch de cooldown apos mudanca de andar (suficiente para evitar dados da transicao). Isso evita perder 1000 frames de dados validos por transicao.

Mudar `floorStableBatches >= 3` para `floorStableBatches >= 1` nas duas versoes (sync e async).

**3. Manter todas as outras protecoes**
- `tz !== camZ` — filtra tiles de outros andares
- `gs.tiles.clear()` — limpa ao mudar de andar
- Viewport radius 40 — filtra tiles distantes
- `id < 100 || id > 9999` — filtra IDs invalidos
- `stackPrio > 5` — filtra itens moveis (mochila, equipamento)

### Resultado esperado

O `snapshotTiles` fica muito mais simples — sem nenhum tratamento especial para underground. A unica filtragem que resta e:
- So andar da camera (`tz !== camZ`)
- So itens estaticos (`stackPrio <= 5`)
- So IDs validos (100-9999)
- So viewport proximo (raio 40)

### Apos aplicar

Re-extrair os .cam problematicos e rodar "Generate Chunks" para reconstruir os dados limpos.

