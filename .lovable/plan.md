
Objetivo: resolver de vez o problema de floor (camZ correto, visual errado) e dos outfits/sprites desalinhados, alinhando parser + renderer ao comportamento do tibiarc/OTClient 7.72.

1) Diagnóstico consolidado (com base no que você reportou + leitura do código open source)
- O sintoma que você mostrou (cam=33035,32433,6 mas render “parece z=7”) é compatível com ordem de desenho de andares invertida.
- No nosso `renderer.ts`, `getVisibleFloors()` monta a lista e faz `reverse()`, o que acaba desenhando o andar base por cima dos andares superiores em vários casos.
- No `packetParser.ts`, ainda existem opcodes com payload incorreto para 7.72 (não só os já corrigidos), o que pode causar desync intermitente e corromper leitura de outfit/tiles depois.
- Comparando com tibiarc (`lib/parser.cpp`, `lib/versions.cpp`, `lib/renderer.cpp`), os pontos críticos restantes são:
  - chat/channel opcodes 0xAB/0xAE/0xAF/0xB0
  - 0x0F e 0x0B também divergentes
  - alguns skips de payload ainda não seguem 7.72
- Em sprite de criatura, ainda faltam detalhes de paridade visual (displacement e padrão de variação/addon), o que explica “monstro/player errado” mesmo quando o parse não quebra totalmente.

2) Implementação proposta (próxima etapa)
A. `src/lib/tibiaRelic/renderer.ts` — corrigir floor visível e ordem de pintura
- Remover inversão indevida em `getVisibleFloors` (eliminar `reverse()` e garantir ordem igual ao tibiarc: bottom -> top no loop de desenho).
- Ajustar cálculo de faixa visível:
  - Surface: `bottomVisibleFloor=7`, `topVisibleFloor` dinâmico (equivalente ao `GetTopVisibleFloor`) para não desenhar andares que deveriam ficar ocultos.
  - Underground: `bottom=min(z+2,15)`, `top=z`.
- Manter offset NW por andar (`xyOffset = camZ - fz`) na mesma direção do tibiarc.
- Resultado esperado: quando `camZ=6` ou `camZ=3`, o visual deixa de “colar” no floor 7.

B. `src/lib/tibiaRelic/packetParser.ts` — fechar gaps de desync 7.72
- Alinhar opcodes ao mapeamento do tibiarc 7.72:
  - `0x0F`: sem payload (hoje está `skip16`, incorreto).
  - `0x0B`: GM actions com skip fixo de versão (7.72 = 32 bytes).
  - `0xAB`: channel list (u8 count + [u16 + string]).
  - `0xAC`: open public channel (u16 + string).
  - `0xAD`: open private conversation (string).
  - `0xAE` e `0xAF`: sem payload.
  - `0xB0`: skip fixo de 2 bytes (não `skip16`).
  - `0x7E`: mesmo payload de trade items (não “no data”).
  - `0x87`: trappers (u8 count + count*u32).
- Revisar `0x96` (open text window) para estrutura de 7.72 sem `skipItem()` ambíguo.
- Manter os fixes já feitos (0xA2 u8, 0x7A sem weight, 0xAA speak mapping).

C. `src/components/TibiarcPlayer.tsx` — robustez de modo de parse
- Para fluxo TibiaRelic 7.72, priorizar `looktypeU16` por padrão (com fallback manual/debug), para evitar falso positivo do auto-detect em arquivos com poucas criaturas no começo.
- Expor indicador de modo ativo e contadores de desync (unknown opcode / parse error) para validação rápida.

D. `src/lib/tibiaRelic/renderer.ts` — paridade de outfit de criatura
- Aplicar displacement do tipo de outfit no desenho da criatura (equivalente ao tibiarc).
- Ajustar seleção de padrões de outfit para direção/addon (`patX/patY`) ao invés de fixar `patY=0` em todos os casos.
- Preservar tint no layer de máscara, mas com índice de sprite calculado na mesma lógica de framegroup usada no tibiarc.

3) Sequência de execução (para reduzir regressão)
1. Corrigir ordem/filtro de floors no renderer (impacto visual imediato no seu caso).
2. Corrigir opcodes restantes de desync no parser.
3. Ajustar outfit displacement + pattern logic.
4. Ajustar estratégia de parse mode (u16-first para 7.72).
5. Rodar validação com seus dois cenários de screenshot e logs.

4) Critérios de aceite (baseados no seu relato)
- Cenário A: `cam=(33035,32433,6)` deve renderizar corretamente o andar superior, sem “voltar” visualmente ao base 7.
- Cenário B: quando estiver em z=3, a cena deve refletir andares acima corretamente (sem aparência de floor base persistente).
- Monstros e players devem aparecer com sprite/outfit consistente (não só nome/hp bar).
- Console sem sequência de `unknown opcode`/`parse error` após chat/channel events e troca de andar.

5) Arquivos previstos para alteração
- `src/lib/tibiaRelic/renderer.ts`
- `src/lib/tibiaRelic/packetParser.ts`
- `src/components/TibiarcPlayer.tsx`

Se você aprovar, eu implemento exatamente nessa ordem para atacar primeiro o bug de floor que você acabou de comprovar nas imagens.
