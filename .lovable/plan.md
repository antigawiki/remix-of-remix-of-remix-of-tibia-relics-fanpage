

# Plano: Diagnóstico e Correção do Drift no Player WASM

## Análise do Problema

O comportamento descrito — corrupção que começa num ponto específico e cascata para tudo depois — é **byte drift no parser C++**. Quando um opcode consome bytes a mais ou a menos, todos os opcodes subsequentes naquele frame são lidos de posições erradas, corrompendo o `Position_` interno do parser. Como o parser C++ é reutilizado entre frames (linha 323 do `web_player.cpp`), a posição corrompida propaga para os frames seguintes.

A correção do flag 0x07 no DAT resolveu sprites errados, mas este problema é diferente — é no **protocolo de pacotes** (opcodes do jogo), não no parser de assets.

## Diagnóstico Necessário

O problema é que **não sabemos qual opcode está causando o drift no C++**. As patches aplicadas cobrem os opcodes conhecidos (0xA4, 0xA7, 0xA8, 0xB6, 0xAA, 0xA0, 0xC8, 0x63, 0xA5, 0xA6), mas pode haver outros opcodes que o tibiarc trata com payloads diferentes do TibiaRelic.

## Plano em 2 Etapas

### Etapa 1: Ferramenta de Diagnóstico — "Frame Drift Detector"

Criar um painel no Cam Player que processa frames pelo parser JS em paralelo ao WASM e identifica:
- **Frames com bytes restantes** (bytesLeftAfterProcess > 0) = o JS leu menos bytes que deveria
- **Frames com erro de parse** = opcode desconhecido ou buffer overflow
- **O primeiro frame problemático** e seus opcodes + hex dump

Isso nos dá o opcode exato que causa drift, sem precisar recompilar o WASM.

**Implementação:**
- Adicionar botão "Scan for Drift" no `CamFrameDebugger`
- Processar todos os frames sequencialmente pelo `PacketParser` JS
- Mostrar uma lista de frames problemáticos com: timestamp, opcodes processados, bytes restantes, hex dump dos bytes não consumidos
- Destacar o PRIMEIRO frame com erro (ponto de origem da corrupção)

### Etapa 2: Aplicar Correção no C++ (após diagnóstico)

Uma vez identificado o opcode problemático:
- Adicionar o patch correspondente no `build-tibiarc.yml`
- Atualizar o `packetParser.ts` se necessário
- Rebuild do WASM

## Mudanças Técnicas (Etapa 1)

### Arquivo: `src/components/CamFrameDebugger.tsx`
- Adicionar botão "Scan All Frames" que roda o PacketParser JS em todos os frames do .cam
- Exibir resultados: lista de frames com drift (bytesLeft > 0 ou erro)
- Para cada frame problemático: timestamp, opcodes, hex dump, bytes restantes
- Progress bar durante o scan (usar `requestAnimationFrame` para não travar UI)

### Arquivo: `src/lib/tibiaRelic/packetParser.ts`
- Garantir que `bytesLeftAfterProcess` é preenchido mesmo em caso de sucesso (já está)
- Adicionar propriedade `lastProcessedBytes` para rastrear quantos bytes foram consumidos

Estimativa: ~200 linhas de código novo, concentrado no `CamFrameDebugger.tsx`.

