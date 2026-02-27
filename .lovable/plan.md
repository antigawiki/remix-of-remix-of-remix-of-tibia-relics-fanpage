

## Reverter o Demuxer TCP (causa da regressao)

### Diagnostico

O demuxer TCP adicionado no `process()` esta ERRADO para o formato `.cam` do TibiaRelic. Cada frame do `.cam` ja contem opcodes puros (sem prefixos TCP de tamanho). O que acontece:

1. O demuxer le os primeiros 2 bytes como "tamanho do sub-pacote" -- mas esses bytes sao na verdade o primeiro opcode + dados
2. Isso desalinha todo o parsing desde o primeiro byte de cada frame
3. Resultado: tela de carregamento, criaturas sumindo, tudo bugado

**Evidencia**: antes do demuxer, tudo funcionava (criaturas apareciam, efeitos mostravam, so tinha problemas de posicionamento). Depois do demuxer, nada funciona.

O formato `.cam` do TibiaRelic grava frames assim:
```text
[timestamp u64] [payload_size u16] [opcodes puros...]
```
O `camParser.ts` ja extrai o payload corretamente. Cada payload e um bloco de opcodes sequenciais, sem sub-pacotes TCP.

### Plano

#### 1. Reverter `process()` para processar opcodes diretamente (`src/lib/tibiaRelic/packetParser.ts`)

Remover o loop de sub-pacotes TCP e voltar a processar o payload inteiro como opcodes sequenciais:

```text
process(payload):
  processOpcodes(r, payload.length)   // direto, sem demuxer
```

O metodo `processOpcodes` ja existe e funciona corretamente -- so precisa ser chamado diretamente.

#### 2. Manter as outras correcoes

As correcoes do `moveCr` (guarda `if (cid === null)`) e do `placeCreatureOnTile` ja estao corretas e devem ser mantidas. O problema era SOMENTE o demuxer TCP.

### Arquivo a Editar

1. **`src/lib/tibiaRelic/packetParser.ts`** -- Simplificar `process()` para chamar `processOpcodes` diretamente sem o loop de demuxer TCP

### Resultado Esperado

- Volta a funcionar como antes (criaturas visiveis, efeitos corretos)
- Mantem as correcoes de `moveCr` e `placeCreatureOnTile` que foram feitas anteriormente
- Mantem os handlers de opcodes 0xa4/0xa5/0xa7/0xa8

