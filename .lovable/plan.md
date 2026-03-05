

## Analise: Cam Player vs Cam Editor/Map

As alteracoes feitas anteriormente (sprLoader.ts, datLoader.ts, mapTileRenderer.ts) sao **exclusivas do parser JavaScript** usado pelo editor de mapa e pela SpriteSidebar. O Cam Player WASM usa a biblioteca C++ `tibiarc` que tem seu **proprio parser de DAT e SPR** compilado no binario.

Isso significa que as flags customizadas (0x50, 0xC8, 0xD0) precisam ser injetadas como **patches no workflow de build** do WASM (`.github/workflows/build-tibiarc.yml`), da mesma forma que ja fazemos com os patches de protocolo.

### O que pode estar causando crashes no player

Se o parser C++ do tibiarc encontrar uma flag desconhecida no DAT (como 0x50), ele provavelmente:
1. Le bytes errados como tamanho de parametro
2. Corrompe a leitura de TODOS os items subsequentes
3. Gera sprite IDs errados para tiles, causando crash ou renderizacao corrupta

### Plano

**1. Patch do DAT parser C++** (`.github/workflows/build-tibiarc.yml`)
- Injetar tratamento das flags customizadas TibiaRelic no parser de DAT do tibiarc
- Flag 0x50: skip 1 byte
- Flag 0xC8: skip 1 byte (se no contexto DAT, nao confundir com opcode OutfitWindow)
- Flag 0xD0: skip 0 bytes (flag booleana)
- Localizar o arquivo correto no source do tibiarc (provavelmente `lib/versions.cpp` ou `lib/datareader.cpp`)

**2. Patch do SPR loader C++** (mesmo workflow)
- Aplicar a mesma correcao de boundary check no decoder RLE do SPR
- Garantir que sprites com `size=0` retornam transparente em vez de crashar

### Desafio

Nao temos acesso direto ao source do tibiarc para ver a estrutura exata do DAT parser. O patch precisa ser feito "as cegas" via `sed` no workflow, similar aos patches de protocolo existentes. Seria necessario:
1. Clonar o repo `antigawiki/tibiarc` localmente para inspecionar os arquivos
2. Identificar onde as flags do DAT sao processadas (provavelmente um `switch` ou `if/else` chain)
3. Escrever os comandos `sed` corretos

### Arquivos a modificar
- `.github/workflows/build-tibiarc.yml` — adicionar patches para o DAT parser e SPR loader do C++

### Nota importante
Apos editar o workflow, sera necessario **executar o workflow manualmente** no GitHub Actions para recompilar o WASM. As alteracoes so terao efeito apos o novo `tibiarc_player.wasm` ser commitado.

