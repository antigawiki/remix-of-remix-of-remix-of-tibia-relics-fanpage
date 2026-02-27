

## Correcao dos Unknown Opcodes com Fallback TCP

### Analise (baseada no codigo fonte do tibiarc)

Analisei o codigo fonte REAL do tibiarc (`lib/formats/cam.cpp`) e descobri que o formato `.cam` usa um `Demuxer(2)` -- um demuxer TCP com headers de 2 bytes (u16 length prefix). Cada frame contem sub-pacotes TCP com prefixos de tamanho.

A evidencia nos logs confirma: os "Unknown opcode 0x0, 0x1, 0x2, 0x3, 0x8" sao os bytes LOW de u16 length prefixes TCP (packets de 0-8 bytes de comprimento).

O formato TibiaRelic e diferente do TibiacamTV (nao usa LZMA, header diferente), mas AMBOS usam TCP length prefixes dentro dos frames.

### Porque o demuxer anterior quebrou tudo

O demuxer anterior assumia que o PRIMEIRO byte de cada frame era um u16 length prefix. Mas no formato TibiaRelic, os frames comecam diretamente com opcodes validos (sem prefix no primeiro pacote). O TCP prefix so aparece ENTRE pacotes dentro do mesmo frame.

### Solucao: Fallback TCP no processOpcodes

Em vez de um demuxer forcado, usamos o parser normal de opcodes com um fallback inteligente: quando encontramos um opcode desconhecido, verificamos se os bytes atuais formam um u16 length prefix TCP valido. Se sim, processamos o sub-pacote. Se nao, paramos como antes.

Isso e seguro porque:
- Frames que comecam com opcodes validos continuam funcionando
- Apenas quando um opcode desconhecido e encontrado, tentamos interpretar como TCP
- A heuristica e simples: u16 > 0 e u16 <= bytes restantes

### Implementacao

#### 1. Refatorar `process()` e `processOpcodes()` (`src/lib/tibiaRelic/packetParser.ts`)

Substituir o loop atual que faz `break` ao encontrar opcode desconhecido por um que tenta TCP fallback:

```text
processOpcodes(r, endPos):
  while (r.pos < endPos):
    opcode = r.u8()
    if (dispatch(opcode)):
      continue  // opcode handled successfully
    
    // Unknown opcode - try TCP length prefix fallback
    r.pos -= 1  // rewind the u8
    if (r.left() >= 2):
      possibleLen = r.peek16()  // peek without consuming
      if (possibleLen > 0 AND possibleLen <= r.left() - 2):
        r.u16()  // consume the length prefix
        subEnd = r.pos + possibleLen
        // Process opcodes within this sub-packet
        processSubPacket(r, Math.min(subEnd, endPos))
        r.pos = subEnd  // ensure alignment
        continue
    
    // Not a valid TCP prefix either - skip to end
    break
```

O metodo `processSubPacket` processa opcodes ate `subEnd`, usando a mesma logica de dispatch mas sem tentar TCP fallback recursivo (para evitar loops infinitos).

### Arquivo a Editar

1. **`src/lib/tibiaRelic/packetParser.ts`** -- Refatorar `processOpcodes()` para incluir TCP fallback quando opcode desconhecido e encontrado

### Resultado Esperado

- Elimina os erros "Unknown opcode 0x0/0x1/0x8" do console
- Processa TODOS os sub-pacotes TCP dentro de cada frame (movimentos, updates de criatura, etc.)
- Melhora significativa na consistencia do estado (tiles, criaturas) especialmente apos seek
- Nao quebra os frames que ja funcionam (comecam com opcodes validos)

