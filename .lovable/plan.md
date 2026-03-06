

## Diagnóstico: o problema é `trySyncPlayerToCamera()` nos scrolls

O código dos scrolls (strips 18x1 / 1x14) está **correto** — as dimensões batem com o protocolo e a memória do projeto confirma isso. O que causa o travamento do boneco é o `trySyncPlayerToCamera()` adicionado em cada scroll handler.

Essa função teleporta o player para `camX,camY,camZ` a cada movimento, **matando a animação de walk** e causando snap visual. Scrolls devem apenas:
1. Atualizar a câmera (camX/Y)
2. Ler os tiles novos da strip
3. **NÃO** mexer na posição do player

O player já é movido pelo opcode `MOVE_CR` (0x6D) que vem antes do scroll no frame.

### Sobre a sugestão do GPT (reordenar SCROLL + FLOOR)

Não se aplica a um parser de replay. Os opcodes vêm em sequência no buffer e seus bytes **devem** ser consumidos na ordem. Não dá para ler FLOOR_DOWN antes de SCROLL porque os bytes do SCROLL estão antes no buffer. O cliente Tibia processa na mesma ordem que recebe — a ordem no pacote JÁ é a ordem correta.

Os `floorUp` e `floorDown` já fazem `camX++/camY++` e `camX--/camY--` respectivamente (linhas 998, 1027), que é exatamente o ajuste de câmera que o GPT menciona.

### Plano

**Arquivo**: `src/lib/tibiaRelic/packetParser.ts`

1. **Remover `trySyncPlayerToCamera()`** dos 4 scroll handlers (scrollN, scrollE, scrollS, scrollW)
2. **Remover a função `trySyncPlayerToCamera()`** inteira (não é usada em mais nenhum lugar)
3. Manter as dimensões de strip (18x1 / 1x14) — estão corretas

Isso resolve o travamento do boneco sem quebrar o parsing.

