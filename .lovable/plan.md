

## Diagnóstico Real: Estamos corrigindo o parser ERRADO

Todas as mudanças feitas até agora foram em `packetParser.ts` — o parser **JavaScript** usado apenas pelas ferramentas de debug (CamFrameDebugger, Protocol Lab). O **WASM player** usa o parser **C++** da biblioteca `tibiarc`, compilado via GitHub Actions. As mudanças no TypeScript têm **zero efeito** na reprodução do vídeo.

O player WASM funciona assim:

```text
.cam file
   ↓
web_player.cpp (load_recording_tibiarelic)
   ↓
Parser::Parse() ← parser C++ do tibiarc (patcheado via sed)
   ↓
Frames com Events
   ↓
event->Update(gamestate) ← aplica no gamestate para renderizar
```

### Por que corrompe aos ~59 minutos (entrada na cave)

O `Parser parser(*g_version, false)` é um **objeto stateful** que persiste entre todos os frames. Ele mantém internamente `Position_` (X, Y, Z da câmera). Quando um frame falha no meio do parse (exceção), o web_player.cpp pega a exceção e pula o frame inteiro — **mas o `Position_` do parser fica corrompido**. Todos os frames seguintes usam coordenadas erradas, causando a cascata de erros.

A transição surface → cave (z=7 → z=8) é o ponto onde o parser C++ provavelmente:
1. Atualiza `Position_.Z` para 8
2. Tenta ler andares subterrâneos com um range errado
3. Encontra bytes inesperados → exceção
4. `Position_` fica em estado inconsistente para sempre

### Plano de Correção (3 mudanças)

#### 1. `web_player.cpp` — Salvar/restaurar Position_ do parser em cada frame

O parser C++ tem `Position_` como membro público. Salvar antes de cada `Parse()`, restaurar se falhar:

```cpp
// Dentro do loop de frames em load_recording_tibiarelic:
auto savedPosition = parser.Position_;  // salvar estado

try {
    DataReader packetReader(sz, buf + pos);
    auto events = parser.Parse(packetReader);
    if (!events.empty()) {
        recording->Frames.emplace_back(timestamp, std::move(events));
        savedPosition = parser.Position_;  // atualizar com sucesso
        parsedFrames++;
    }
} catch (...) {
    parser.Position_ = savedPosition;  // restaurar estado anterior
    failedFrames++;
}
```

Isso garante que se um frame falhar, o parser continua com a última posição válida.

#### 2. `.github/workflows/build-tibiarc.yml` — Patch para FloorDown (0xBF)

O workflow tem patch para FloorUp (0xBE) mas **NENHUM para FloorDown (0xBF)**. O fork pode ter modificado FloorDown também. Precisamos verificar e, se necessário, reverter para o comportamento padrão. Adicionaremos um patch que garanta que FloorDown leia o número correto de andares.

#### 3. `.github/workflows/build-tibiarc.yml` — Stuck-buffer detection no C++

Adicionar ao parser C++ a mesma lógica de detecção de buffer travado que implementamos no JS. Isso evita que `ParseFloorDescription` fique em loop infinito ao encontrar dados desconhecidos:

```cpp
// Dentro de ParseFloorDescription, após tentar ler tile:
// Se a posição do reader não avançou, abortar o andar
if (reader.Position() == posBeforeTile && tileSkip == 0) {
    return tileSkip; // abortar sem corromper
}
```

### Arquivos a alterar

- `tibiarc-player/web_player.cpp` — Position_ save/restore no loop de frames
- `.github/workflows/build-tibiarc.yml` — Patch para FloorDown + stuck-buffer detection no C++

### Importante

Após essas mudanças, será necessário executar o workflow **Build tibiarc WASM Player** no GitHub Actions para recompilar o WASM. As mudanças no TypeScript já feitas (stuck-buffer, scan-forward) beneficiam apenas as ferramentas de debug.

