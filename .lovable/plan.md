

## Adaptar tibiarc WASM para o formato TibiaRelic

### Problema

O tibiarc reconhece `.cam` como formato **TibiacamTV**, que usa header de 32 bytes + LZMA compression. Os arquivos `.cam` do TibiaRelic tem estrutura completamente diferente (header 12 bytes, frames raw sem compressao). Quando o WASM tenta parsear um TibiaRelic `.cam`, ele tenta descomprimir LZMA em dados raw e crasheia com uma excecao C++.

### Solucao

Adicionar uma funcao dedicada `load_recording_tibiarelic` no `web_player.cpp` que parseia o formato TibiaRelic diretamente, alimentando os frames no Parser/Gamestate do tibiarc sem passar pelo `Recordings::Read`.

### Mudancas

#### 1. `tibiarc-player/web_player.cpp` - Nova funcao de carregamento TibiaRelic

Adicionar uma funcao C exportada `load_recording_tibiarelic` que:

1. Le o header TibiaRelic (12 bytes): u32 version, f32 fps, 4 bytes extras
2. Itera pelos frames: u64 timestamp_ms + u16 payload_size + payload
3. Alimenta cada payload no `Parser` e `Demuxer` do tibiarc (header size 2 para reassemblar pacotes TCP)
4. Constroi um `Recording` com os frames parseados
5. Inicializa o `Gamestate` e faz o fast-forward ate o player estar inicializado

A funcao recebe os mesmos parametros que `load_recording_with_version` mas sabe que o formato e TibiaRelic.

```text
// Pseudo-codigo da nova funcao:
EMSCRIPTEN_KEEPALIVE
int load_recording_tibiarelic(const uint8_t *buf, int len,
                               int ver_major, int ver_minor, int ver_patch) {
    // 1. Parse header (12 bytes)
    uint32_t version = read_u32_le(buf, 0);
    float fps = read_f32_le(buf, 4);
    int pos = 12;

    // 2. Create Version with data files
    VersionTriplet triplet(ver_major, ver_minor, ver_patch);
    g_version = make_unique<Version>(triplet, picReader, sprReader, datReader);

    // 3. Parse frames into Recording
    Parser parser(*g_version, false);
    Demuxer demuxer(2);  // TCP-style 2-byte header
    auto recording = make_unique<Recording>();

    uint64_t ts0 = 0;
    bool first = true;

    while (pos + 10 <= len) {
        uint64_t ts = read_u64_le(buf, pos);
        uint16_t sz = read_u16_le(buf, pos + 8);
        pos += 10;

        if (sz == 0 || pos + sz > len) break;
        if (first) { ts0 = ts; first = false; }

        auto timestamp = chrono::milliseconds(ts - ts0);
        DataReader fragment(sz, buf + pos);

        demuxer.Submit(timestamp, fragment,
            [&](DataReader packetReader, auto ts) {
                recording->Frames.emplace_back(ts, parser.Parse(packetReader));
            });

        pos += sz;
    }

    demuxer.Finish();

    // 4. Set runtime and initialize gamestate
    recording->Runtime = recording->Frames.back().Timestamp;
    g_recording = move(recording);
    g_gamestate = make_unique<Gamestate>(*g_version);

    // 5. Fast-forward until player initialized
    // ... (same logic as existing load_recording)

    return (int)(g_recording->Runtime.count());
}
```

#### 2. `tibiarc-player/web_player.cpp` - Export nova funcao

Adicionar `_load_recording_tibiarelic` a lista de `EXPORTED_FUNCTIONS`.

#### 3. `.github/workflows/build-tibiarc.yml` - Atualizar exports

Adicionar `_load_recording_tibiarelic` ao parametro `-s EXPORTED_FUNCTIONS` e adicionar `-fexceptions` ao build para capturar erros graciosamente em vez de crashear.

```text
EXPORTED_FUNCTIONS='[
  "_main","_load_data_files","_load_recording",
  "_load_recording_tibiarelic",
  "_play","_pause_playback","_set_speed",
  "_get_progress","_get_duration","_seek",
  "_is_playing","_malloc","_free"
]'
```

Adicionar `-fexceptions -s DISABLE_EXCEPTION_CATCHING=0` para suportar try/catch no WASM.

#### 4. `src/components/TibiarcPlayer.tsx` - Chamar funcao TibiaRelic

Alterar a chamada de `load_recording_with_version` para `load_recording_tibiarelic`:

```typescript
// Antes:
const dur = mod.ccall('load_recording_with_version', 'number',
  ['number', 'number', 'number', 'number', 'number', 'number'],
  [bufPtr, data.length, namePtr, 7, 72, 0]);

// Depois:
const dur = mod.ccall('load_recording_tibiarelic', 'number',
  ['number', 'number', 'number', 'number', 'number'],
  [bufPtr, data.length, 7, 72, 0]);
```

### Proximos passos apos implementacao

Sera necessario **recompilar o WASM** executando o workflow do GitHub Actions apos o merge das mudancas no `web_player.cpp`. O build vai gerar novos `tibiarc_player.js` e `tibiarc_player.wasm` com suporte ao formato TibiaRelic.

### Resumo dos arquivos

| Arquivo | Mudanca |
|---------|---------|
| `tibiarc-player/web_player.cpp` | Adicionar `load_recording_tibiarelic` com parser dedicado para formato TibiaRelic |
| `.github/workflows/build-tibiarc.yml` | Adicionar export da nova funcao + flags de excecao |
| `src/components/TibiarcPlayer.tsx` | Chamar `load_recording_tibiarelic` em vez de `load_recording_with_version` |

