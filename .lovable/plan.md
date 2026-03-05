

## Diagnóstico: Position_ Save/Restore e MapDesc Guard estão causando os problemas

### Problema 1: Position_ Save/Restore é contra-produtivo

Quando um frame falha no meio do parsing:
1. O parser já atualizou `Position_` (ex: Z=7 → Z=8 após entrar na cave)
2. O frame lança exceção em algum opcode posterior
3. Restauramos `Position_` para Z=7
4. **Mas o servidor já está em Z=8** — todos os frames seguintes enviam dados para Z=8
5. O parser lê dados de Z=8 usando cálculos de Z=7 → tiles errados, black squares, personagem "fora da tela"

Cada frame tem seu próprio buffer isolado (`DataReader packetReader(sz, buf + pos)`), então o stream entre frames não fica desalinhado. O problema é puramente que Position_ não reflete mais o estado real do servidor.

**Antes** do nosso patch, o comportamento era: exceção → Position_ mantém o valor parcial (mais próximo do estado real do servidor). **Nosso patch tornou isso pior.**

### Problema 2: MapDesc guard (< 100 bytes) pula atualizações legítimas

```cpp
if (reader.Remaining() < 100) return;
```

Isso pula MapDescription packets pequenos mas válidos. O resultado:
- `Position_.X` e `Position_.Y` são lidos e atualizados ANTES do guard
- Mas as tiles NÃO são lidas → gamestate tem posição nova sem tiles → **black squares**

### Problema 3: dat_patch.py removido pode expor crashes

O fork tem tratamento para flags 0x50, 0xC8, 0xD0, mas se o .dat tiver OUTRAS flags customizadas, o parser C++ pode crashar ao carregar. Precisamos de um wrapper try-catch, mas sem o scan por 0xFF que corrompia.

### Plano de Correção (3 mudanças)

#### 1. Remover Position_ save/restore em `web_player.cpp`

Voltar ao comportamento original: se um frame falha, Position_ mantém o último valor que o parser definiu. Isso é mais correto que reverter para um estado que não reflete o servidor.

```cpp
// ANTES (bugado):
auto savedPosition = parser.Position_;
try {
    auto events = parser.Parse(packetReader);
    savedPosition = parser.Position_;
} catch (...) {
    parser.Position_ = savedPosition; // ERRADO: reverte estado válido
}

// DEPOIS (correto):
try {
    auto events = parser.Parse(packetReader);
    // ...
} catch (...) {
    // Position_ fica como o parser deixou — mais próximo do servidor
    failedFrames++;
}
```

#### 2. Remover MapDesc guard em `.github/workflows/build-tibiarc.yml`

Remover completamente o `sed` que injeta `if (reader.Remaining() < 100) return;`. Se o packet é pequeno, deixar o parser nativo tratar (ele vai ler o que puder e parar).

#### 3. Restaurar dat_patch.py com implementação segura

Alterar `dat_patch.py` para NÃO scanear por 0xFF. Em vez disso, apenas capturar a exceção e retornar (abandonar as properties desse item, manter defaults):

```python
# try-catch sem scan — apenas ignora o erro
"    } catch (...) {\n"
"        /* TibiaRelic: custom flag error, skip remaining properties */\n"
"        return;\n"
"    }\n"
```

E re-adicionar a chamada no workflow.

### Arquivos a alterar

- `tibiarc-player/web_player.cpp` — remover save/restore de Position_
- `tibiarc-player/dat_patch.py` — trocar scan-0xFF por simple return
- `.github/workflows/build-tibiarc.yml` — remover MapDesc guard, re-adicionar dat_patch.py

### Após as mudanças

Rebuild via GitHub Actions e substituir os .wasm/.js.

