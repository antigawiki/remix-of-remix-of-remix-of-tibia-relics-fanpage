

## Diagnóstico: Os patches de scroll no fork são a causa raiz

### O que encontrei

O fork `antigawiki/tibiarc` tem as mudanças do `fix-scroll-floor-range.patch` **baked in** (commitadas diretamente). Essas mudanças fazem:

1. **Scroll (0x65-0x68)**: Lê 18x14 viewport completo em vez de 1 coluna/linha
2. **FloorUp (0xBE)**: Lê apenas 1 floor em vez de 6 ao subir para superfície
3. **ParseMapDescription**: Relaxa o assert de tileSkip e adiciona `reader.Remaining() < 2` guard

O problema é que o `.patch` file **nunca é aplicado via workflow** — ele foi commitado direto no fork. E o workflow faz `git clone` do fork, recebendo essas mudanças automaticamente.

**Por que isso causa o crash:** Se o TibiaRelic envia scroll padrão (1 coluna = ~14 tiles), mas o parser tenta ler 18x14 = 252 tiles, ele consome bytes do próximo opcode → byte drift massivo → todos os opcodes seguintes são lidos errados → tela preta/crash.

### Evidência

Os logs do console mostram que o frame inicial (0x0A + 0x64 mapDesc) funciona perfeitamente — porque `mapDesc` sempre lê viewport completo. O crash acontece quando o jogador se move (scroll), porque aí o parser tenta ler 252 tiles quando só ~14 foram enviados.

### Solução

Adicionar `sed` commands ao workflow para **reverter os patches de scroll** no fork antes de compilar, restaurando o comportamento padrão:

```text
Scroll East  (0x65): ler 1×14 (nova coluna à direita)
Scroll North (0x66): ler 18×1 (nova linha acima)
Scroll South (0x67): ler 18×1 (nova linha abaixo)  
Scroll West  (0x68): ler 1×14 (nova coluna à esquerda)
FloorUp (0xBE z==7): ler 6 floors (5→0), não apenas 1
```

O guard `reader.Remaining() < 2` no `ParseMapDescription` pode ficar — é uma proteção segura que não causa byte drift.

### Mudanças

| Arquivo | Mudança |
|---------|---------|
| `.github/workflows/build-tibiarc.yml` | Adicionar sed commands para reverter scroll para comportamento padrão (1 col/row) e restaurar floorUp completo |

### Detalhe técnico dos sed commands

```bash
# Reverter scroll East: 18x14 → 1×14
sed -i 's/ParseMapDescription(reader, events, -8, -6, Map::TileBufferWidth, Map::TileBufferHeight);.*full 18x14.*East/ParseMapDescription(reader, events, +9, -6, 1, Map::TileBufferHeight);/' ...

# Similar para North, South, West
# Reverter floorUp: restaurar loop 5→0
```

Isso restaura o parser ao comportamento original do tibiarc para scrolls — que é o que funcionava antes.

