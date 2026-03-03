

## Fix: WASM Seek Crashes — Recompilacao Necessaria

### Problema raiz

O crash acontece porque a funcao `seek()` no C++ processa frames SEM try-catch individual. Quando um frame contem tiles/itens nao reconhecidos, o parser do tibiarc lanca uma excecao. No `MainLoop`, cada frame tem try-catch e frames corrompidos sao pulados. No `seek`, nao — uma excecao mata todo o seek.

Alem disso, a biblioteca `libtibiarc.a` e compilada via CMake SEM `-fexceptions`, entao as excecoes lancadas dentro do parser nao sao catchable pelo `web_player.cpp`. Elas viram traps do WASM (os numeros tipo "2409064").

### Solucao: Duas mudancas

**1. Arquivo: `tibiarc-player/web_player.cpp`** — Adicionar try-catch por frame no `seek()` e `FastForwardToPlayer()`, identico ao que ja existe no `MainLoop`:

```cpp
// seek() — linha 337-343, mudar para:
while (g_needle != g_recording->Frames.cend() &&
       g_needle->Timestamp <= target) {
    try {
        for (auto &event : g_needle->Events) {
            event->Update(*g_gamestate);
        }
    } catch (...) {
        // Skip corrupted frame during seek
    }
    g_needle = std::next(g_needle);
}

// FastForwardToPlayer() — linha 65-73, mudar para:
while (!g_gamestate->Creatures.contains(g_gamestate->Player.Id) &&
       g_needle != g_recording->Frames.cend()) {
    try {
        for (auto &event : g_needle->Events) {
            event->Update(*g_gamestate);
        }
    } catch (...) {
        // Skip corrupted frame
    }
    g_needle = std::next(g_needle);
}
```

**2. Arquivo: `.github/workflows/build-tibiarc.yml`** — Adicionar `-fexceptions` e `-DCMAKE_CXX_FLAGS=-fexceptions` na compilacao da biblioteca tibiarc para que as excecoes lancadas dentro do parser sejam catchable:

```yaml
emcmake cmake .. \
  -DTIBIARC_NO_LIBAV=ON \
  ...
  -DCMAKE_CXX_FLAGS="-fexceptions"
```

### Por que isso resolve

- Com `-fexceptions` na libtibiarc, as excecoes do parser (itens/tiles desconhecidos) propagam corretamente ate o try-catch no web_player.cpp
- Com try-catch por frame no `seek()`, frames problematicos sao pulados (identico ao comportamento do `MainLoop` e do parser JS antigo)
- O seek nao crasheia mais — apenas pula os frames com dados nao reconhecidos

### Sequencia

1. Editar `tibiarc-player/web_player.cpp` — adicionar try-catch no seek e FastForwardToPlayer
2. Editar `.github/workflows/build-tibiarc.yml` — adicionar -fexceptions na compilacao da lib
3. Rodar o workflow no GitHub Actions para recompilar
4. Commit automatico dos arquivos .wasm/.js atualizados

### Nota

Apos aprovar, farei as edicoes nos dois arquivos. Depois sera necessario rodar o workflow `Build tibiarc WASM Player` no GitHub Actions para gerar o novo `tibiarc_player.wasm` e `tibiarc_player.js`.

