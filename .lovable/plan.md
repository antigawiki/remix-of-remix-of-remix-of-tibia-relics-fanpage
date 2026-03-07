

## Diagnóstico: A Raiz do Problema

Comparei opcode por opcode o `packetParser.ts` (player) com o `extractionParser.ts` (extrator de mapa que funciona 100%) e o `ProtocolParser.ts` do projeto Cam Mapper. Encontrei **bugs de consumo de bytes** em handlers de opcodes conhecidos que causam **byte drift** — o parser come bytes a mais ou a menos, e todos os opcodes seguintes ficam desalinhados.

Os "opcodes desconhecidos" (0x00, 0x03, 0x07, 0x08, 0x09) no relatório do Protocol Lab **não são opcodes reais** — são bytes de dados que o parser está lendo como opcode porque um handler anterior consumiu bytes errado. Isso explica os 18.654 DESYNCs.

### Bugs confirmados (packetParser vs extractionParser)

| Opcode | packetParser (atual) | extractionParser (correto) | Impacto |
|--------|---------------------|---------------------------|---------|
| **0x96** TextWindow | `u32 + u16 + u16 + skip16` (1 string) | `u32 + u16 + u16 + str + str` (2 strings) | Falta 1 string inteira |
| **0xAE** RuleViolChannel | nenhum payload | `u16` (2 bytes) | -2 bytes drift |
| **0xAF** RemoveReport | nenhum payload | `string` | Falta string inteira |
| **0xB0** RuleViolCancel | `skip(2)` fixo | `string` (u16 len + dados) | Lê 2 bytes fixos vs string variável |
| **0xAA** Talk type 6 | não tratado (cai no default) | `u16` | -2 bytes drift em rule violation talk |
| **0x9A** PlayerPos | lê `pos3` (5 bytes) + atualiza câmera | nenhum payload | +5 bytes drift se servidor não envia dados |

### Plano de Correção

**1. Alinhar handlers de opcodes no `packetParser.ts`**

Corrigir os 6 handlers acima para consumir exatamente os mesmos bytes que o extractionParser. Isso é a correção principal e deve resolver a grande maioria dos DESYNCs.

**2. Implementar resync por scan-forward como safety net**

Após a correção dos handlers, adicionar um mecanismo de recuperação para opcodes verdadeiramente desconhecidos: em vez de descartar o frame inteiro, escanear byte a byte até encontrar um opcode conhecido, verificar se o parse a partir dali é válido (tentativa de parse sem side-effects), e continuar. Isso é o safety net para qualquer opcode futuro que não mapeamos.

Lógica do resync:
- Salvar posição atual do buffer
- Escanear até 256 bytes procurando um byte que `isKnownOpcode()` retorna true
- Para cada candidato, tentar parse em modo dry-run (cópia do buffer, sem alterar gamestate)
- Se o candidato parsear com sucesso, pular até ali e continuar
- Se nenhum candidato funcionar, descartar o resto do frame (comportamento atual)

**3. Portar correções para patches WASM (C++)**

Atualizar `protocol_patch.py` com as mesmas correções de consumo de bytes para manter sincronia TS↔WASM.

### Arquivos afetados
- `src/lib/tibiaRelic/packetParser.ts` — correção de 6 handlers + resync engine
- `tibiarc-player/protocol_patch.py` — portar correções para WASM

### Prioridade
A correção dos handlers (etapa 1) é a mais impactante e deve ser feita primeiro. O resync (etapa 2) é segurança adicional. As correções WASM (etapa 3) são necessárias para o player visual funcionar igual.

