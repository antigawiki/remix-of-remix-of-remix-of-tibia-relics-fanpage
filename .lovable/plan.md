

## Plano: Rastreamento de Opcodes Desconhecidos no Protocol Lab

### Problema
O Protocol Lab atual detecta anomalias (PARSE_ERROR, DESYNC, etc.) mas **não rastreia opcodes desconhecidos** especificamente. Quando `dispatch()` retorna `false`, o parser pula o resto do frame — mas não registra qual opcode causou isso nem quantos bytes foram perdidos. Precisamos saber quais opcodes desconhecidos aparecem com mais frequência e quanto dado é descartado por causa de cada um.

### Mudanças

**1. PacketParser — expor opcodes desconhecidos e bytes descartados**

Adicionar ao `PacketParser`:
- `lastFrameUnknownOpcodes: { opcode: number; bytesSkipped: number }[]` — resetado a cada `process()`
- Em `processDirectOpcodes`, quando `dispatch` retorna `false`, registrar o opcode e `endPos - r.pos` (bytes descartados) antes de pular

**2. camProtocolLab.ts — coletar estatísticas de opcodes desconhecidos**

- Na Phase 1, após processar cada frame, ler `parser.lastFrameUnknownOpcodes`
- Acumular em um `unknownOpcodeMap: Record<string, { count: number; totalBytesLost: number }>` 
- Adicionar ao `LabResult`:
  - `unknownOpcodeMap` com contagem e bytes perdidos por opcode
  - Incluir na recomendação os top 5 opcodes desconhecidos

**3. ProtocolLabTab.tsx — exibir seção de opcodes desconhecidos**

Nova seção no card de resumo: "Opcodes Desconhecidos" com tabela mostrando:
- Opcode (hex)
- Ocorrências
- Total de bytes perdidos
- Média de bytes perdidos por ocorrência

Ordenado por bytes perdidos (mais impactante primeiro). Cada opcode terá um badge de cor para indicar severidade.

### Escopo
- 3 arquivos editados: `packetParser.ts`, `camProtocolLab.ts`, `ProtocolLabTab.tsx`
- Sem mudanças no motor WASM — é análise offline via parser JS

