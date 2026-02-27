

## Solucao Definitiva: TCP Demuxer Robusto com Deteccao Automatica

### Diagnostico

Os erros "Unknown opcode 0x0, 0x1, 0x2, 0x8" sao **prefixos TCP u16** (length headers de sub-pacotes) que nao estao sendo processados corretamente. O fallback TCP atual falha porque:

1. Para opcode 0x0: a checagem `possibleLen > 0` rejeita pacotes de tamanho 0
2. Para opcodes 0x1/0x2/0x8: o byte ja foi consumido como u8, entao o `peek16()` le bytes desalinhados
3. O fallback so tenta TCP APOS falhar no dispatch, perdendo contexto

### Causa Raiz

O formato `.cam` do tibiarc usa um TCP demuxer (confirmado pelo `web_player.cpp` que usa `Recordings::Read` com demuxer interno). Cada frame payload contem **sub-pacotes TCP** com prefixo u16 de tamanho. Porem, nem todos os frames usam esse formato -- alguns comecam direto com opcodes validos.

### Solucao: Deteccao Automatica por Frame

Modificar `process()` para detectar automaticamente se o frame usa TCP sub-packets ou opcodes diretos:

1. Peek nos primeiros 2 bytes do frame como u16 (possivel TCP length)
2. Se o valor faz sentido como tamanho TCP (> 0, < tamanho total do frame, e o primeiro byte APOS o sub-pacote tambem e um u16 valido OU o sub-pacote consome o frame inteiro), usar modo TCP
3. Se o primeiro byte e um opcode valido (0x0A-0xF1), usar modo direto
4. Heuristica: se o primeiro byte < 0x0A (nao e um opcode valido), e quase certamente um TCP length prefix

### Implementacao

#### Arquivo: `src/lib/tibiaRelic/packetParser.ts`

**1. Substituir `process()` com deteccao automatica:**

```text
process(payload):
  r = new Buf(payload)
  
  // Heuristica: primeiro byte < 0x0A nao e opcode valido no protocolo 7.72
  // Opcodes validos comecam em 0x0A (login). Bytes < 0x0A indicam TCP prefix.
  firstByte = payload[0]
  
  if (firstByte < 0x0A AND payload.length >= 2):
    // TCP demuxer mode
    processTcpDemux(r, payload.length)
  else:
    // Direct opcodes mode (com TCP fallback para sub-packets intermediarios)
    processOpcodes(r, payload.length)
```

**2. Novo metodo `processTcpDemux()`:**

```text
processTcpDemux(r, totalLen):
  while r.pos + 2 <= totalLen:
    subLen = r.u16()
    if subLen == 0:
      continue  // skip empty TCP packets
    if r.pos + subLen > totalLen:
      // Invalid length - maybe not TCP after all, try as opcodes
      r.pos -= 2  // rewind the u16
      processDirectOpcodes(r, totalLen)  // no TCP fallback to avoid recursion
      return
    subEnd = r.pos + subLen
    processDirectOpcodes(r, subEnd)
    r.pos = subEnd  // ensure alignment even if opcode parse stopped early
```

**3. Simplificar `processOpcodes()` para incluir TCP fallback inline:**

```text
processOpcodes(r, endPos):
  while r.pos < endPos:
    t = r.u8()
    if dispatch(t, r): continue
    
    // Unknown opcode - try TCP demux for rest of frame
    r.pos -= 1
    processTcpDemux(r, endPos)
    return
```

**4. `processDirectOpcodes()` - sem fallback (para uso dentro de sub-packets TCP):**

Renomear o atual `processSubPacket` para `processDirectOpcodes` -- processa opcodes ate endPos sem tentar TCP fallback. Usado DENTRO de sub-pacotes TCP ja demuxados.

### Porque Esta Solucao e Definitiva

- Frames que comecam com TCP (byte < 0x0A) sao demuxados corretamente desde o inicio
- Frames que comecam com opcodes diretos (byte >= 0x0A) funcionam normalmente
- Se um opcode desconhecido aparece no meio de opcodes diretos, tenta TCP demux pro resto
- Pacotes TCP de tamanho 0 sao ignorados (resolve o erro 0x00)
- Pacotes TCP de tamanho 1-8 sao processados corretamente (resolve 0x01, 0x02, 0x08)
- Nenhuma recursao infinita (processDirectOpcodes nunca tenta TCP)
- Tolerante a falhas: se TCP demux falha, para graciosamente

### Resultado Esperado

- Zero erros "Unknown opcode" no console
- Tiles renderizados nas posicoes corretas
- Estabilidade durante seek e playback longo
