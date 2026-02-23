

# Player de Replays Tibia (.cam) na Web

## Resumo

Integrar o **tibiarc** (compilado para WebAssembly via Emscripten) ao projeto para permitir upload e reproducao de arquivos `.cam` do Tibia 7.4 diretamente no navegador. O tibiarc ja suporta oficialmente a compilacao para WASM e inclui um modo GUI/player para navegador.

---

## Pre-requisito: Compilacao Externa

O tibiarc e um projeto em C que precisa ser compilado para WebAssembly usando Emscripten. Isso **nao pode ser feito dentro do Lovable** - precisa ser feito uma unica vez em uma maquina com Linux ou WSL.

### Passos para compilar (fora do Lovable):

```text
# 1. Instalar Emscripten
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh

# 2. Clonar tibiarc
git clone https://github.com/tibiacast/tibiarc.git
cd tibiarc

# 3. Compilar para WASM
mkdir build-wasm && cd build-wasm
emcmake cmake ..
emmake make

# Resultado: gui.js, gui.wasm (e possivelmente gui.data)
```

### Arquivos resultantes necessarios:
- `gui.js` - loader JavaScript gerado pelo Emscripten
- `gui.wasm` - binario WebAssembly
- Opcionalmente `gui.data` - dados empacotados

### Arquivos de dados do Tibia 7.4:
- `Tibia.dat` - metadados de itens/criaturas
- `Tibia.spr` - sprites (imagens)
- `Tibia.pic` - imagens da interface (pode usar de versao posterior se nao encontrar)

Esses arquivos podem ser encontrados em: https://downloads.ots.me/?dir=data/tibia-clients/dat_and_spr_collections

---

## O que faremos no Lovable (apos a compilacao)

### 1. Hospedagem dos arquivos WASM

Adicionar os arquivos compilados ao projeto:
- `public/tibiarc/gui.js`
- `public/tibiarc/gui.wasm`
- `public/tibiarc/data/Tibia.dat`
- `public/tibiarc/data/Tibia.spr`
- `public/tibiarc/data/Tibia.pic`

### 2. Nova pagina: `src/pages/CamPlayerPage.tsx`

- Layout fullscreen sem sidebars (como XP Tracker)
- Area de upload para arquivos `.cam`
- Canvas onde o player WASM renderiza o jogo
- Controles de reproducao: Play/Pause, velocidade (1x, 2x, 4x), barra de progresso
- Estilizado no tema do projeto (wood-panel)

### 3. Componente wrapper: `src/components/TibiarcPlayer.tsx`

- Carrega o modulo WASM (gui.js)
- Injeta o arquivo `.cam` no sistema de arquivos virtual do Emscripten (MEMFS)
- Conecta o canvas HTML5 ao renderer WASM
- Expoe controles de reproducao via callbacks JavaScript

### 4. Rota e navegacao

- Nova rota `/cam-player` no `src/App.tsx`
- Links no Sidebar e Header (icone Film/Play do lucide)
- Traducoes nos 4 idiomas:
  - PT: "Player de Replays"
  - EN: "Replay Player"
  - ES: "Reproductor de Replays"
  - PL: "Odtwarzacz Powtórek"

---

## Fluxo do usuario

```text
1. Acessa /cam-player
2. Ve a interface com area de upload
3. Arrasta ou seleciona um arquivo .cam
4. O arquivo e carregado na memoria do WASM (MEMFS)
5. O tibiarc renderiza frame a frame no canvas
6. Usuario controla play/pause, velocidade, timeline
```

---

## Limitacoes e consideracoes

- **Tamanho**: Os arquivos Tibia.dat + Tibia.spr juntos tem ~20-30MB. Serao carregados na primeira visita e cacheados pelo navegador
- **Performance**: O WASM roda com performance proxima de nativo, muito melhor que a abordagem TypeScript pura do otwebclient
- **Formatos suportados**: Alem de `.cam`, o tibiarc suporta `.rec`, `.tmv2`, `.trp`, `.ttm`, `.yatc`, `.recording` - todos poderiam funcionar
- **Versoes**: Suporte bom para Tibia 7.11 ate 8.62, cobrindo o 7.4

---

## Proximo passo imediato

Para comecar, voce precisaria:
1. Compilar o tibiarc para WASM (instrucoes acima)
2. Fazer upload dos arquivos resultantes (`gui.js`, `gui.wasm`) para o projeto
3. Fazer upload dos arquivos de dados do Tibia 7.4 (`Tibia.dat`, `Tibia.spr`, `Tibia.pic`)

Com esses arquivos em maos, eu construo toda a interface, integracao e controles de reproducao.

