

## Diagnóstico: Validação estrita em `readTileItems` mata frames que o C++ processaria normalmente

Analisei o código extensivamente e identifiquei três diferenças fundamentais entre o parser JS e o C++ que explicam por que os erros persistem independentemente das mudanças de scroll/floor range.

### Problema 1: `readTileItems` lança exceção em items "inválidos"

Na linha 997, adicionamos uma validação estrita:
```typescript
throw new Error(`[readTileItems] Invalid tile word 0x${word.toString(16)}...`);
```

Quando um `u16` não é skip marker (≥0xFF00), creature marker (0x61/0x62/0x63), nem item no range 100-9999, o parser **lança exceção**. O C++ não faz isso — ele simplesmente tenta processar o word como item normalmente. Se o item não existe no DAT, nenhum byte extra é lido e a vida continua.

Esta exceção propaga-se até `scroll()` ou `mapDesc()`, que revertem a câmera e abortam. O restante dos opcodes no frame é perdido.

### Problema 2: Range de item IDs hardcoded como 100-9999

O range real depende do `itemMaxId` do arquivo `.dat`. A validação deveria usar o valor real do DAT em vez de um número fixo. Além disso, words entre 1-99 e words acima do `itemMaxId` podem aparecer legitimamente em frames com skip encoding residual entre floors.

### Problema 3: `processDirectOpcodes` para completamente no primeiro erro

Quando um opcode falha, `break` encerra o processamento de TODO o restante do frame. O C++ também perde o frame inteiro em caso de exceção durante parsing, MAS o C++ quase nunca lança exceção porque não tem a validação estrita do Problema 1.

### Plano de correção

**Passo 1: Remover throw em `readTileItems`, substituir por break gracioso**

Quando um word é inválido, em vez de lançar exceção:
- Reverter os 2 bytes lidos (pos -= 2)
- Salvar os items lidos até agora no tile
- Retornar skip = 0 (fim do tile)
- Logar warning no debugLogger

Isso imita o comportamento do C++ onde a leitura de tiles para naturalmente quando encontra dados não reconhecidos.

**Passo 2: Usar `itemMaxId` do DAT em vez de 9999**

O `PacketParser` já recebe o `DatLoader`. Usar `dat.items` para validar se um word é um item real: `this.dat.items.has(word)` em vez de `word >= 100 && word <= 9999`.

**Passo 3: Tornar `processDirectOpcodes` mais resiliente**

Em vez de `break` no primeiro erro, tentar recuperar: pular 1 byte e procurar o próximo opcode válido (scan forward). Se encontrar um opcode conhecido dentro de 4 bytes, resumir parsing.

### Mudanças

| Arquivo | Mudança |
|---------|---------|
| `packetParser.ts` | `readTileItems`: remover throw, usar break gracioso com rewind |
| `packetParser.ts` | `readTileItems`: validar items via `dat.items.has(word)` |
| `packetParser.ts` | `processDirectOpcodes`: scan-forward recovery em vez de break |

