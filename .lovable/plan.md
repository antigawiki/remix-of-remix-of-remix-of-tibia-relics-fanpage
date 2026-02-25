
# Fix: Outfits de criaturas e remover mensagens

## O que foi confirmado
- Floor rendering esta perfeito (confirmado pelo usuario)
- Console mostra `unknown opcode 0x63 at pos 6` repetidamente - frames inteiros sendo abandonados, perdendo dados de criaturas
- Mensagens de chat cobrem a area de jogo e precisam ser removidas

## Causa dos outfits errados

### Bug principal: Opcode 0x63 nao tratado
O console mostra `unknown opcode 0x63` repetidamente. 0x63 e o marcador CR_OLD (creature turn) que normalmente aparece DENTRO de tile data. Porem, ele esta aparecendo como opcode de topo em frames do `.cam`. Quando isso acontece, o parser **abandona o frame inteiro** (incluindo centenas de bytes de dados de criaturas, movimentos e atualizacoes). Resultado: criaturas perdem dados de outfit, posicao, ou simplesmente nao aparecem.

A solucao: tratar 0x63 como standalone creature turn. Tambem tratar 0x61 e 0x62 (CR_FULL e CR_KNOWN) como standalone, pois podem aparecer da mesma forma.

### Bug secundario: Payload com prefixo de tamanho
Alguns frames do `.cam` podem incluir um prefixo `u16` de tamanho do pacote (padrao TCP do Tibia). Se os 2 primeiros bytes formam um u16 que iguala `payload.length - 2`, devemos pular esse prefixo. Isso explicaria o deslocamento consistente de 6 bytes (2 len + 4 checksum ou similar).

## Mudancas

### A. `src/lib/tibiaRelic/renderer.ts`
1. **Remover `drawMessages`** - remover a chamada e o metodo inteiro
2. **Remover texto de debug** no canto inferior (`cam=(x,y,z) crs=N`)

### B. `src/lib/tibiaRelic/packetParser.ts`
1. **Adicionar opcodes 0x61, 0x62, 0x63 no dispatch** como standalone creature handlers:
   - 0x61 (CR_FULL standalone): ler como `readCreatureFull` (sem posicao, pois ja tem x/y/z do contexto anterior, ou usar posicao da criatura existente)
   - 0x62 (CR_KNOWN standalone): ler como `readCreatureKnown` (sem adicionar a tile)
   - 0x63 (CR_OLD standalone): ler `u32 creatureId + u8 direction` (creature turn simples, 5 bytes)
2. **Adicionar deteccao de prefixo u16** no metodo `process()`: se `payload[0:2]` como u16 LE == `payload.length - 2`, pular 2 bytes antes de parsear opcodes
3. **Melhorar recovery de erro**: ao encontrar opcode desconhecido, tentar pular 1 byte e continuar ao inves de abandonar o frame inteiro (com limite de tentativas para evitar loop infinito)

### C. `src/lib/tibiaRelic/gameState.ts`
Sem alteracoes necessarias.

## Detalhes tecnicos

### Opcodes standalone de criatura
No dispatch, adicionar:
```text
0x61: pos3(5) + readCreatureFull (mesma logica de addThing com CR_FULL, mas pos vem antes)
0x62: pos3(5) + readCreatureKnown (mesma logica)
0x63: pos3(5) + stackPos(1) + u16_marker(2) + u32_cid(4) + u8_dir(1)
      OU formato simples: u32_cid(4) + u8_dir(1)
```
Como nao temos certeza do formato exato do TibiaRelic para estes opcodes standalone, vamos tentar o formato completo (com pos3+stackpos+marker) primeiro, e se falhar, o formato simples.

Na pratica, a abordagem mais segura e tratar 0x63 como: ler os bytes restantes no padrao `chgThing` (pos3 + stackpos + peek creature marker + creature data), pois e o mesmo formato que 0x6B mas identificado com opcode diferente.

### Deteccao de prefixo
```text
process(payload):
  r = new Buf(payload)
  // Check for u16 length prefix
  if payload.length >= 4:
    prefixLen = r.peek16()
    if prefixLen == payload.length - 2:
      r.skip(2)  // skip length prefix
```

### Error recovery
```text
Ao encontrar opcode desconhecido:
  - Tentar pular 1 byte
  - Continuar parseando
  - Maximo 3 skips consecutivos antes de abandonar
```

## Impacto esperado
- Frames com creature turns (0x63) deixarao de ser abandonados, preservando todas as atualizacoes de criatura no frame
- Criaturas manterao seus dados de outfit corretamente ao longo do tempo
- Player deixara de "sumir" quando seus dados de atualizacao estavam em frames abandonados
- Area de jogo limpa sem mensagens sobrepostas
