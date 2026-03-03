

## Forking tibiarc para aplicar fixes no WASM player

### Situacao atual

O workflow `.github/workflows/build-tibiarc.yml` clona o tibiarc diretamente do repositorio upstream (`github.com/tibiacast/tibiarc`), compila `libtibiarc.a`, e linka com o nosso `web_player.cpp`. Os bugs estao **dentro do `parser.cpp` da libtibiarc** — codigo que nao controlamos.

### O que precisamos fazer

**1. Criar um fork do tibiarc**

Voce precisa fazer um fork de `github.com/tibiacast/tibiarc` para a sua conta/org do GitHub. Isso nos da controle total sobre o `parser.cpp`.

**2. Aplicar patches no fork**

Dois fixes no `parser.cpp` do fork:

**Fix A — Mini MAP_DESC (0x64):** Na funcao `ParseFullMapDescription` (linha ~549):
```cpp
void Parser::ParseFullMapDescription(DataReader &reader, EventList &events) {
    auto &event = AddEvent<PlayerMoved>(events);
    event.Position = Position_ = ParsePosition(reader);

    // Guard: if too few bytes remain, this is a position-only update
    // (common in custom servers that send mini 0x64 packets)
    if (reader.Remaining() < 100) {
        return;
    }

    ParseMapDescription(reader, events, -8, -6,
                        Map::TileBufferWidth, Map::TileBufferHeight);
}
```

**Fix B — FloorChangeUp/Down sync:** Estes ja geram eventos `PlayerMoved` que o gamestate processa, entao o tibiarc C++ provavelmente ja trata isso corretamente (diferente do nosso parser JS). Precisamos confirmar olhando as funcoes `ParseFloorChangeUp/Down` no fork.

**3. Atualizar o workflow**

Mudar a linha do clone no `.github/workflows/build-tibiarc.yml`:
```yaml
- name: Clone tibiarc
  run: |
    git clone https://github.com/SEU-USUARIO/tibiarc.git /tmp/tibiarc
```

**4. Rodar o workflow**

Disparar manualmente o workflow `Build tibiarc WASM Player` via GitHub Actions. Ele compila e commita os novos `tibiarc_player.js` e `tibiarc_player.wasm`.

### Pre-requisitos

- Voce precisa criar o fork manualmente no GitHub (eu nao consigo fazer isso)
- Aplicar o patch no `parser.cpp` do fork (posso gerar o patch exato apos voce criar o fork)
- Garantir que o GitHub Actions tem permissao de escrita no repositorio

### Proximo passo

Me diga o nome do seu fork (ex: `seu-usuario/tibiarc`) e eu atualizo o workflow + gero o patch completo para o `parser.cpp`.

