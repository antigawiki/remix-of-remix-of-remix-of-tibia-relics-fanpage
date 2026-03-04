

## Diagnóstico: Scroll lê 18x14 (viewport inteiro) quando deveria ler 1 row/column

Encontrei o bug principal que ainda causa problemas. Está no `scroll()` handler (linhas 509-538).

### O problema

O handler de scroll lê **18x14 tiles (252 tiles)** para TODAS as 4 direções. Mas o protocolo Tibia 7.72 envia apenas:
- Norte/Sul: **18x1** (1 nova linha de tiles)
- Leste/Oeste: **1x14** (1 nova coluna de tiles)

Isso significa que a cada passo do jogador, o parser tenta ler ~252 tiles quando só existem 18 ou 14 no buffer. Os ~234 tiles restantes são lidos dos **bytes dos próximos opcodes**, corrompendo tudo.

Além disso, a **origem** está errada para 3 das 4 direções — todas usam `(camX-8, camY-6)` quando cada direção tem uma origem diferente (a borda recém-revelada do viewport).

### Por que "melhorou um pouco"

A validação que adicionamos no `readTileItems` agora detecta o byte drift e lança erro. O `catch` no `scroll()` reverte a câmera, evitando corrupção permanente. Mas o resto do frame é perdido, causando desync intermitente.

### Por que "funciona em alguns cams e não em outros"

Cams com poucos scrolls (jogador parado/teleportando) usam `mapDesc` (18x14 correto) → funciona. Cams com muito movimento → muitos scrolls → corrupção a cada passo.

### Correção

Usar as dimensões e origens corretas per OTClient 7.72:

```text
Direção   | Opcode | Dimensões | Origem (após cam update)
----------|--------|-----------|------------------------
Norte     | 0x65   | 18 × 1    | (camX-8, camY-6)
Leste     | 0x66   | 1 × 14    | (camX+9, camY-6)
Sul       | 0x67   | 18 × 1    | (camX-8, camY+7)
Oeste     | 0x68   | 1 × 14    | (camX-8, camY-6)
```

### Mudança técnica

**`packetParser.ts` — método `scroll()`** (linhas 509-538):

Substituir os 4 `readMultiFloorArea` idênticos por chamadas com dimensões e origens corretas por direção. Cada direção lê apenas a faixa de tiles que o servidor realmente envia.

### Arquivo alterado

| Arquivo | Mudança |
|---------|---------|
| `packetParser.ts` | `scroll()`: dimensões corretas por direção (18x1 ou 1x14) e origens corretas |

