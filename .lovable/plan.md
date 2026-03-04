

## Protocol Reverse-Engineering Lab

A ideia é criar uma ferramenta de diagnóstico avançada que, ao processar uma .cam, faça testes automáticos com diferentes estratégias de parsing para cada frame que dá erro, mapeando exatamente quais bytes o TibiaRelic envia e como devemos lê-los.

### Conceito

Em vez de apenas detectar anomalias, a nova ferramenta vai:

1. **Processar a .cam normalmente** e registrar cada erro (BufOverflow, opcode desconhecido, desync)
2. **Para cada frame com erro**, fazer um "replay isolado" desse frame com múltiplas estratégias alternativas e comparar os resultados
3. **Gerar um relatório detalhado** mostrando byte-a-byte o que cada opcode consumiu, onde o parsing divergiu, e qual estratégia funcionou

### Estratégias de Teste por Frame

Para cada frame que falha, o lab tentará:

- **Estratégia A (atual)**: ±2 floors, u16 looktype, TCP demux
- **Estratégia B**: ±1 floor (talvez o relic mande menos em certos casos)
- **Estratégia C**: ±3 floors (testar se algum cenário manda mais)
- **Estratégia D**: Single floor only (floor da câmera apenas)
- **Estratégia E**: Skip multi-floor data entirely (consumir 0 floors, só position)

Cada estratégia registra: bytes consumidos, bytes restantes, opcodes parseados com sucesso, primeiro erro.

### Componentes

**1. `src/lib/tibiaRelic/camProtocolLab.ts`** — Engine de testes:
- Recebe um ArrayBuffer da .cam e o DatLoader
- Processa todos os frames, registrando para cada um: opcodes, bytes consumidos, erros
- Quando um frame falha, clona o GameState antes do frame e re-executa com cada estratégia
- Para cada opcode multi-floor (0x64, 0x65-0x68, 0xBE, 0xBF), registra byte-level trace
- Gera um `LabResult` com: frames totais, frames com erro, mapa de erros por opcode, resultados de cada estratégia por frame

**2. `src/lib/tibiaRelic/packetParser.ts`** — Instrumentação adicional:
- Adicionar um modo `traceMode` que registra, para cada `readTileItems`, `readFloorArea`, `readMultiFloorArea`: posição inicial/final no buffer, tiles lidos, skip count
- Expor o `getFloorRange` como configurável (aceitar override de floor range)
- Adicionar setter para floor range strategy para que o lab possa testar diferentes ranges

**3. Nova aba no CamAnalyzerPage** — UI do Protocol Lab:
- Tab "Analyzer" (existente) + Tab "Protocol Lab" (novo)
- Botão "Run Protocol Lab" que executa a análise profunda
- Tabela de resultados mostrando cada frame com erro e qual estratégia teve sucesso
- Para cada frame, expandir para ver o byte-level trace
- Hex dump do payload do frame com highlights coloridos por opcode
- Resumo estatístico: "de 50 frames com erro, 45 funcionaram com ±1 floor, 3 com single floor, 2 irrecuperáveis"
- Recomendação automática: baseado nos resultados, sugere qual floor range usar

### Mudanças Técnicas

**packetParser.ts:**
- Adicionar `floorRangeOverride?: { plus: number, minus: number }` nas options
- Quando presente, `getFloorRange` usa o override em vez do ±2 hardcoded
- Adicionar `traceLog: TraceEntry[]` que registra posição do buffer antes/depois de cada operação multi-floor
- Novo tipo `TraceEntry = { op: string, posBefore: number, posAfter: number, bytesConsumed: number, floor?: number, error?: string }`

**camProtocolLab.ts:**
- `runProtocolLab(data: ArrayBuffer, datLoader: DatLoader, onProgress)` → `LabResult`
- Para cada frame: processa normalmente, se der erro → snapshot do GameState → re-tenta com cada estratégia
- `LabResult` contém: `errorFrames: ErrorFrame[]`, `strategySummary: Record<string, number>`, `opcodeErrorMap: Record<string, number>`, `recommendation: string`

**CamAnalyzerPage.tsx:**
- Adicionar Tabs component com "Análise" e "Protocol Lab"
- Protocol Lab tab com sua própria UI de resultados
- Hex viewer inline para payloads de frames com erro

### Resultado Esperado

Após rodar o Protocol Lab com uma .cam real, teremos dados concretos como:
- "O opcode 0x64 (mapDesc) falha em 30 frames. Em 28 deles, a estratégia ±2 funciona mas a superfície z=7 precisa de exatamente 3 floors, não 5"
- "O opcode 0xBE (floorUp) falha em 5 frames. Em 4 deles, o servidor envia apenas 1 floor novo, não os 2 esperados"
- Isso nos dá a informação exata para corrigir o parser de forma definitiva.

