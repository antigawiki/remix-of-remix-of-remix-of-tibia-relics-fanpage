

## Diagnóstico: Scroll handler consome dados demais — causa raiz encontrada

### O problema real

Investiguei a fundo o parser TS comparando com o protocolo padrão do OTClient e o comportamento do WASM. Encontrei a causa raiz principal:

**O handler de scroll (opcodes 0x65-0x68) lê 18×14 tiles (viewport inteiro) quando deveria ler apenas a faixa nova (18×1 ou 1×14).**

No protocolo Tibia 7.x, quando o jogador anda e a câmera desloca, o servidor envia apenas a nova faixa de tiles que entrou no viewport:
- Norte (0x65): 18×1 (uma linha no topo)
- Leste (0x66): 1×14 (uma coluna à direita)
- Sul (0x67): 18×1 (uma linha embaixo)
- Oeste (0x68): 1×14 (uma coluna à esquerda)

O parser TS lê **252 tiles** (18×14) quando deveria ler **18 ou 14 tiles**. Isso consome dados que pertencem aos próximos opcodes, corrompendo toda a leitura subsequente. Como scrolls acontecem a cada passo do jogador, a corrupção é imediata e total desde o primeiro movimento.

O WASM usa o parser C++ do tibiarc que implementa o protocolo padrão (faixas). Os patches de build confirmam: "SCROLL patches REMOVED — reverted to original fork behavior."

### Plano de correção

**Arquivo: `src/lib/tibiaRelic/packetParser.ts`**

Alterar o método `scroll()` para calcular as dimensões e offsets corretos da faixa baseado na direção, seguindo exatamente o protocolo OTClient:

```text
Direção dx,dy → Faixa (ox, oy, W, H)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Norte  0,-1 → (camX-8, camY-6,  18, 1)
Leste  1, 0 → (camX+9, camY-6,   1, 14)
Sul    0, 1 → (camX-8, camY+7,  18, 1)
Oeste -1, 0 → (camX-8, camY-6,   1, 14)
```

O `readMultiFloorArea` continua sendo usado (a faixa é lida em todos os andares visíveis, com skip encoding), apenas com dimensões corretas.

### Impacto esperado

Esta é a correção mais impactante possível — elimina a corrupção massiva que acontece a cada passo do jogador. Com as dimensões corretas de scroll, o parser TS deve manter sincronismo com os dados do servidor para a maioria dos frames, resultando em renderização correta da geometria do mapa.

