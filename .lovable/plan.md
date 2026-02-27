

## Correcao Definitiva: Demuxer TCP + moveCr

### Descoberta Principal: Falta de Demuxer TCP

Analisei o codigo fonte do tibiarc (github.com/tibiacast/tibiarc) e descobri a causa raiz de TODOS os problemas de posicionamento:

**Cada frame do arquivo .cam contem MULTIPLOS pacotes TCP concatenados, cada um com seu proprio prefixo de tamanho (u16).** O tibiarc usa uma classe `Demuxer` para reassemblar esses sub-pacotes antes de processa-los. Nosso codigo trata cada frame como um unico blob de opcodes, o que causa:

1. Prefixos TCP de sub-pacotes sao lidos como opcodes (ex: `0x07` = low byte de um tamanho)
2. Frames inteiros sao abandonados quando um prefixo nao-opcode e encontrado
3. Pacotes de movimento, adicao e remocao de criaturas sao PERDIDOS silenciosamente
4. Estado do jogo (tiles, posicoes) fica desincronizado progressivamente

Evidencia nos logs: `Unknown opcode 0x07 at pos 13` -- o byte `0x07` e parte de um prefixo de tamanho TCP, nao um opcode real.

### Bug Secundario: moveCr Format A -- busca por posicao presa dentro do if

No `moveCr` Format A, a busca por posicao (step 2) esta DENTRO do bloco `if (stackpos aponta pra criatura)`. Se o stackpos aponta para um item ou esta fora do range, o codigo pula direto pro fallback "qualquer criatura no tile", movendo a criatura ERRADA.

### Bug Terciario: moveCr Format B (0xFFFF) invalido para 7.72

O tibiarc so usa 0xFFFF em `moveCr` quando `ModernStacking` esta ativo (versoes > 8.x). Para 7.72, x=0xFFFF nunca deveria acontecer -- indica erro de parsing anterior. Nosso codigo tenta interpretar `fy` como creature ID, potencialmente movendo criaturas para posicoes erradas.

---

### Plano de Implementacao

#### 1. Implementar Demuxer TCP no `process()` (`src/lib/tibiaRelic/packetParser.ts`)

Substituir a logica de deteccao de prefixo unico por um loop de sub-pacotes TCP:

```text
process(payload):
  while (bytes restantes >= 2):
    packetLen = readU16()  // prefixo TCP
    if (packetLen <= 0 || packetLen > bytes restantes):
      // Nao e um prefixo valido -- tenta processar como opcodes raw
      retrocede 2 bytes
      processa opcodes ate o fim
      break
    endPos = pos + packetLen
    while (pos < endPos):
      opcode = readU8()
      dispatch(opcode)
    pos = endPos  // garante alinhamento
```

Isso garante que TODOS os sub-pacotes dentro de cada frame sejam processados, eliminando os erros `Unknown opcode 0x07` e recuperando todos os pacotes de movimento/tile que estavam sendo perdidos.

#### 2. Corrigir nesting do moveCr Format A (`src/lib/tibiaRelic/packetParser.ts`)

Mover a busca por posicao (step 2) para FORA do bloco condicional do stackpos:

```text
Antes:
  if (stackpos aponta pra criatura) {
    tenta match...
    if (falhou) {
      busca por posicao  // <-- PRESO AQUI DENTRO
    }
  }
  if (cid === null) { any creature fallback }

Depois:
  if (stackpos aponta pra criatura) {
    tenta match...
  }
  if (cid === null) {
    busca por posicao    // <-- AGORA INDEPENDENTE
  }
  if (cid === null) { any creature fallback }
```

#### 3. Corrigir moveCr Format B (0xFFFF) (`src/lib/tibiaRelic/packetParser.ts`)

Para protocolo 7.72, tratar x=0xFFFF como operacao invalida (nao existe ModernStacking). Apenas ler os bytes para manter o parser alinhado, mas NAO mover nenhuma criatura.

---

### Arquivos a Editar

1. **`src/lib/tibiaRelic/packetParser.ts`**
   - Metodo `process()` (~linha 149-184): Implementar loop de sub-pacotes TCP
   - Metodo `moveCr()` (~linhas 462-498): Corrigir nesting e tratamento de 0xFFFF

### Resultado Esperado

- Todos os sub-pacotes TCP dentro de cada frame serao processados (fim dos `Unknown opcode 0x07`)
- Criaturas aparecerao nas posicoes corretas (movimentos nao serao mais perdidos)
- Consistencia entre efeitos de combate (sangue, magia) e posicao das criaturas
- Floor bugs reduzidos drasticamente (dados de mapa nao serao mais descartados)

