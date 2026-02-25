

# Correção dos Sprites Fora do Lugar no CAM Player

## Diagnóstico

Comparei o Python e o TypeScript linha por linha. A renderização e o parsing de pacotes são idênticos. O problema mais provável está em **dessincronia no parsing de tiles** causada pela leitura incorreta de bytes extras em items stackable/fluid/splash, e na **falta de offsets de elevação e deslocamento** na renderização.

Quando o `skipItem` lê 1 byte a mais ou a menos para algum item, **todos os dados subsequentes ficam deslocados**, causando tiles com sprites errados.

## Correções Planejadas

### 1. Adicionar verificação automática do DatLoader (diagnóstico)
**Arquivo:** `src/lib/tibiaRelic/datLoader.ts`

Adicionar a mesma verificação do Python após carregar o `.dat`:
- item 100 deve ter sprite_ids[0] = algum valor válido
- item 102 deve mapear para sprite 42
- item 408 deve mapear para sprite 39
- item 870 deve mapear para sprite 559

Se algum falhar, logar aviso no console indicando que as flags do `.dat` estão incorretas. Isso ajuda a identificar rapidamente se a causa é o DatLoader.

### 2. Aplicar offsets de elevação e deslocamento na renderização
**Arquivo:** `src/lib/tibiaRelic/renderer.ts`

Atualmente, `elevation`, `dispX` e `dispY` são lidos do `.dat` mas ignorados na renderização. No Tibia, `elevation` desloca itens para cima (simulando altura), e `dispX`/`dispY` deslocam sprites em pixels.

Mudanças:
- Ao desenhar cada tile, acumular `elevation` dos items do ground
- Aplicar offset de elevação nos sprites subsequentes do mesmo tile
- Aplicar `dispX`/`dispY` como offset em pixels no `drawImage`

### 3. Melhorar o tratamento de erros no parser de pacotes
**Arquivo:** `src/lib/tibiaRelic/packetParser.ts`

- Adicionar validação de limites antes de ler items em `readTileItems`
- Adicionar contagem de tiles lidos vs esperados em `readBlock` e logar diferenças
- Proteger `skipItem` contra IDs fora do range do `.dat`
- Logar opcodes desconhecidos ao invés de lançar exceção (para não perder sync)

### 4. Corrigir a ordem de renderização por stack priority
**Arquivo:** `src/lib/tibiaRelic/renderer.ts`

Ordenar items de cada tile por `stackPrio` antes de desenhar:
- 0 = ground (primeiro)
- 1 = clip (borda)
- 2 = bottom
- 3 = top
- 5 = items normais

Isso garante que sprites de chão sejam desenhados antes de objetos e criaturas.

### 5. Adicionar logging de diagnóstico temporário
**Arquivo:** `src/lib/tibiaRelic/packetParser.ts`

Para o primeiro `mapDesc` (0x64), logar:
- Total de tiles esperados (18x14=252)
- Total de tiles efetivamente lidos
- Primeiros N items de cada tile para comparação visual

Isso permite identificar rapidamente se há dessincronia no stream de bytes.

## Resultado Esperado

Com a verificação do DatLoader, saberemos imediatamente se as flags estão corretas. Com elevation/displacement, items empilhados serão posicionados corretamente. Com melhor error handling, o parser não perde sync ao encontrar dados inesperados.

