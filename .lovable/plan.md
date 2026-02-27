

## Correcao dos Efeitos Magicos + Bugs de Floor

### Causa Raiz Principal: DatLoader le efeitos/misseis com formato errado

Investiguei o codigo fonte do OTClient (thingtype.cpp, linha 546-549) e descobri a causa raiz definitiva:

```text
// OTClient - thingtype.cpp
if (g_game.getClientVersion() >= 755)
    m_numPatternZ = fin->getU8();   // le patZ para TODOS os tipos
else
    m_numPatternZ = 1;
```

Para versao >= 7.55 (inclui 7.72), o campo `patZ` e lido para **TODOS** os tipos: items, outfits, efeitos E misseis. Essa funcao e universal - nao distingue categoria.

Nosso `DatLoader` usa `hasPatZ = true` para items e outfits (correto), mas `hasPatZ = false` para efeitos e misseis (ERRADO). Isso causa:

1. **Offset de 1 byte por entrada**: Ao pular o byte de patZ, o valor de patZ e lido como `anim`, e o verdadeiro `anim` vira parte dos sprite IDs
2. **Erro em cascata**: Cada efeito le um numero errado de sprites, deslocando o ponteiro `p` incorretamente
3. **Todos os efeitos E misseis ficam com sprites errados**: A corrupcao se propaga por TODAS as entradas subsequentes

Isso explica perfeitamente por que os efeitos aparecem (estao sendo renderizados) mas com sprites completamente errados -- nao sao efeitos de magia, sao sprites aleatorios de outras posicoes no arquivo.

### Problema Secundario: Opcode 0xa8 nao tratado

Os logs mostram `Unknown opcode 0xa8` sendo disparado frequentemente, causando abandono de frames inteiros. Cada frame abandonado perde potencialmente dados importantes (movimentos de criaturas, atualizacoes de tile, efeitos). No protocolo 7.72, 0xa8 provavelmente e "creatureSquare" (marcacao de criatura) com payload de 5 bytes (u32 creatureId + u8 color). Opcodes 0xa4-0xa7 tambem podem aparecer e devem ser tratados.

### Plano de Implementacao

#### 1. Corrigir DatLoader - efeitos e misseis com patZ (`src/lib/tibiaRelic/datLoader.ts`)

Mudar `hasPatZ` de `false` para `true` nas linhas 80-89:

```text
Antes:
  effects:  this.readEntry(bytes, view, p, false)   // ERRADO
  missiles: this.readEntry(bytes, view, p, false)   // ERRADO

Depois:
  effects:  this.readEntry(bytes, view, p, true)    // CORRETO
  missiles: this.readEntry(bytes, view, p, true)    // CORRETO
```

Tambem atualizar o comentario do metodo `readEntry` que diz "true for items" para refletir que e para todos os tipos em versao >= 7.55.

#### 2. Adicionar handlers para opcodes faltantes (`src/lib/tibiaRelic/packetParser.ts`)

Adicionar tratamento para opcodes que estao causando abandono de frames:
- **0xa4**: spellCooldown -- skip 2 bytes (u16 spellId)
- **0xa5**: spellGroupCooldown -- skip 5 bytes (u8 groupId + u32 delay)
- **0xa7**: setPlayerModes -- skip 3 bytes (u8 fight + u8 chase + u8 safe)
- **0xa8**: creatureSquare -- skip 5 bytes (u32 creatureId + u8 color)

Isso evita que frames inteiros sejam descartados por causa de opcodes desconhecidos.

#### 3. Manter mapeamento de IDs sem offset

Manter `effectId: effectType` e `missileId: missileType` (sem +1). O protocolo padrao envia IDs 1-based, e o DatLoader armazena a partir de ID 1. Com o patZ corrigido, os sprite IDs serao os corretos.

### Arquivos a Editar

1. **`src/lib/tibiaRelic/datLoader.ts`** -- Mudar `hasPatZ` para `true` em efeitos e misseis (linhas 80-89)
2. **`src/lib/tibiaRelic/packetParser.ts`** -- Adicionar handlers para opcodes 0xa4, 0xa5, 0xa7, 0xa8

### Resultado Esperado

- Efeitos de sangue, fogo, energia aparecerao corretamente durante combate
- Projéteis (flechas, magias) mostrarao os sprites corretos
- Menos frames abandonados = menos bugs de floor e criaturas invisíveis
- Textos de dano e XP continuarao funcionando com as cores corretas

