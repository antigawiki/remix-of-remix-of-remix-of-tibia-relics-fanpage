

## Plano: Alinhar o parser TypeScript com a abordagem do WASM

### Diagnóstico

Após análise detalhada do código C++ (web_player.cpp, build-tibiarc.yml) e do parser TS (packetParser.ts, datLoader.ts), identifiquei as divergências concretas que causam a renderização quebrada desde o primeiro frame:

### Divergências encontradas

**1. OutfitWindow Range — 2 bytes de drift por ocorrência**
O JsCamPlayer passa `outfitWindowRangeU16: true`, fazendo o parser ler 4 bytes (u16+u16) no opcode 0xC8. O WASM usa u8+u8 (2 bytes). Cada outfit dialog causa 2 bytes de drift.

**2. Tratamento de erros — abordagem oposta ao C++**
O C++ (WASM) ao encontrar erro num frame **lança exceção e pula o frame inteiro**. O TS tenta "recuperar" com scan-forward de 128 bytes, o que frequentemente posiciona o parser em bytes que parecem opcodes válidos mas não são, corrompendo o estado de forma silenciosa e progressiva.

**3. Pré-processamento vs processamento on-the-fly**
O WASM pré-processa todos os frames durante o carregamento (load_recording_tibiarelic), criando eventos estruturados. Frames com erro são descartados antes da reprodução. O TS processa frames crus durante a animação, acumulando erros.

**4. SanitizeCreatureState — limpeza ausente**
O WASM executa `SanitizeCreatureState()` após seek e durante playback, removendo criaturas fantasma, duplicatas, e entidades em posições inválidas. O TS não tem equivalente durante o playback contínuo.

**5. Validação de flags DAT (isStackable/isFluid/isSplash)**
Se o extractMetadata do TS falhar silenciosamente em algum item (boundary check prematuro ou flag desconhecida antes de 0x05/0x0A/0x0B), o skipItem() lê bytes errados em TODAS as tiles que contêm esse item. Uma flag errada num único item causa drift progressivo em toda a cam.

### Plano de correção

**Arquivo: `src/components/JsCamPlayer.tsx`**

1. Corrigir `outfitWindowRangeU16: false` na criação do PacketParser
2. Implementar pré-processamento: ao carregar o .cam, processar todos os frames antecipadamente (como o WASM), descartando frames com erro. Armazenar snapshots de GameState em intervalos (keyframes) para seek eficiente
3. Chamar `dedupCreaturesOnTiles()` periodicamente durante playback (a cada N frames)

**Arquivo: `src/lib/tibiaRelic/packetParser.ts`**

4. Alterar `processDirectOpcodes`: remover o scan-forward de 128 bytes em caso de erro. Quando um opcode desconhecido ou exceção ocorrer, **abortar o frame inteiro** (throw), igual ao C++
5. Remover `scanForwardToOpcode` — esta lógica não existe no C++ e introduz mais erros do que resolve

**Arquivo: `src/lib/tibiaRelic/datLoader.ts`**

6. Adicionar validação cruzada no `extractMetadata`: após extrair flags, comparar a contagem de bytes consumidos com o tamanho do bloco de atributos. Se houver discrepância significativa, logar warning com o item ID para diagnóstico
7. Melhorar boundary checks em `extractMetadata` — usar `p + N <= end` (inclusive) em vez de `p + N < end` (exclusivo) para evitar perder o último byte de flags como isStackable

### Impacto esperado

A correção #1 é pequena mas previne drift futuro. As correções #4-5 (fail-fast) são as mais impactantes — eliminam a corrupção silenciosa que ocorre quando o scan-forward interpreta dados como opcodes. A correção #6-7 garante que as flags de items estejam corretas, eliminando o drift de 1 byte por tile.

Mesmo com todas as correções, a paridade visual total com o WASM **não é garantida** — o C++ tem um renderer completamente diferente com fonts SDL e composição nativa. Mas a geometria do mapa (posição dos tiles) deve ficar correta.

