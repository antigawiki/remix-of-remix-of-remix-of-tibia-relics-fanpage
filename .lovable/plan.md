

## Aplicar fix de moveCr no player WASM C++

### Contexto

O fix de `creatures_map` fallback já funciona no JS parser. O player WASM (C++) sofre do mesmo problema: quando `moveCr` (0x6d) não encontra a criatura na tile de origem (tile foi reconstruída por scroll), a criatura fica "fantasma". O C++ do tibiarc usa `Gamestate::Creatures` (um map de `creatureId → Creature`) — exatamente o mesmo padrão que o JS.

### O que fazer

**1. Criar patch file `tibiarc-player/fix-movecr-fallback.patch`**

Patch para `lib/parser.cpp` na função que processa o opcode 0x6d (`ParseCreatureMove` ou equivalente). O tibiarc original faz lookup por stackpos na tile. O patch adiciona um fallback: se a criatura não for encontrada na tile, busca no `Gamestate::Creatures` por posição (x, y, z) igual à posição de origem. Se encontrada, remove da tile antiga e processa o move normalmente.

O patch precisa ser escrito contra o código-fonte do fork `antigawiki/tibiarc`. Como não temos acesso direto ao `lib/parser.cpp` do fork aqui, o approach mais seguro é adicionar a lógica via `sed` no workflow (mesmo padrão dos patches existentes), ou aplicar o `.patch` file.

**2. Atualizar `build-player.yml`** 

Adicionar step para aplicar o patch `fix-movecr-fallback.patch` (e o já existente `fix-scroll-floor-range.patch`) via `git apply` antes da compilação.

**3. Migrar patches sed para .patch files**

Converter os 4 fixes de protocolo (0xA4, 0xA7, 0xA8, 0xB6) que hoje são `sed` em arquivos `.patch` para maior robustez. Porém, como o moveCr fallback requer entender a estrutura exata do `ParseCreatureMove` no fork C++, a abordagem mais prática é:

- Manter os sed patches existentes (já funcionam)
- Aplicar `fix-scroll-floor-range.patch` via `git apply`
- Para o moveCr fallback, injetar via sed no `Gamestate` ou no event handler que processa o move

### Problema: não temos o código-fonte C++ aqui

O fork `antigawiki/tibiarc` é clonado durante o CI. Sem ver o código real de `ParseCreatureMove` e a struct `Gamestate::Creatures`, o patch pode não compilar.

### Alternativa mais segura

Em vez de patchar o parser C++, injetar a lógica de dedup **no `web_player.cpp`** (que nós controlamos):

Antes de cada `RenderFrame()`, varrer `g_gamestate->Creatures` e remover entradas duplicadas (mesma posição, mesmo nome) ou criaturas cujas posições estão fora do viewport. Isso é um band-aid no renderer, não no parser, mas:
- Não requer patchar código que não temos
- Resolve o sintoma visual (ghosting)
- É fácil de implementar e testar

### Plano de implementação

| File | Action |
|------|--------|
| `tibiarc-player/web_player.cpp` | Adicionar função `DeduplicateCreatures()` que varre `g_gamestate->Creatures`, detecta criaturas com mesma posição e remove duplicatas. Chamar antes de `RenderFrame()` no `MainLoop()` e no `seek()` |
| `.github/workflows/build-player.yml` | Adicionar step para aplicar `fix-scroll-floor-range.patch` via `git apply` (já existe o arquivo) |

### DeduplicateCreatures — lógica

```text
for each creature in Creatures:
  key = (x, y, z)
  if key already seen:
    mark duplicate for removal (keep the one with player ID priority)
  else:
    add key to seen set
remove all marked duplicates
```

Isso elimina o ghosting visual sem tocar no parser C++ que não controlamos.

