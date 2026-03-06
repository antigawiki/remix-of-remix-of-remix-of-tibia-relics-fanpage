

## Diagnóstico: Player TypeScript com renderização quebrada

### O problema
As imagens mostram tiles espalhados com grandes lacunas escuras, geometria completamente errada desde o primeiro frame. Isso é um problema **conhecido e documentado** — o motor JS foi anteriormente rejeitado justamente por essas falhas de renderização.

### Causa raiz
O PacketParser JS tem **byte drift** em relação ao parser C++ do WASM. Opcodes customizados do TibiaRelic (0xA4, 0xA7, 0xB6, etc.) são consumidos com quantidades diferentes de bytes, o que corrompe a leitura de TODOS os dados subsequentes no frame. O primeiro `0x64` (MapDescription) já pode ficar desalinhado, resultando em tiles nas posições erradas desde o início.

Além disso, há um bug estrutural no `JsCamPlayer.tsx`: o `playbackLoop` cria um **novo PacketParser a cada frame de animação**, perdendo qualquer estado interno do parser entre chamadas.

### Plano de correção

**1. Corrigir o bug do parser recriado a cada frame (`JsCamPlayer.tsx`)**
- Mover a criação do `PacketParser` para fora do `playbackLoop` — criar uma vez durante o carregamento do arquivo e reutilizá-lo via ref
- Isso preserva o estado interno do parser entre frames consecutivos

**2. Adicionar aviso visual na aba TypeScript (`CamPlayerPage.tsx`)**
- Exibir um banner de aviso abaixo das tabs quando a aba TypeScript estiver ativa, informando que o motor TS é experimental e tem qualidade inferior ao WASM
- Algo como: "⚠ Motor experimental — a renderização pode apresentar artefatos visuais"

**3. Ativar seekMode no parser durante replay (`JsCamPlayer.tsx`)**
- Configurar `parser.seekMode = true` durante o processamento em lote (processFramesUpTo) para evitar acúmulo de efeitos visuais que prejudicam a performance

### Arquivos alterados
- `src/components/JsCamPlayer.tsx` — Corrigir recriação do parser, seekMode
- `src/pages/CamPlayerPage.tsx` — Adicionar aviso experimental

### Nota importante
Mesmo com essas correções, a paridade visual com o WASM **não é garantida** devido às divergências fundamentais de protocolo entre o parser JS e o C++. O motor TypeScript continuará sendo inferior ao WASM para reprodução fiel.

