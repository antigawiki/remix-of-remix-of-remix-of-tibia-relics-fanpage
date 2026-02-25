
Objetivo: corrigir os dois sintomas do caso que você mostrou (players “dentro da montanha” e outfits não formados) alinhando parser + renderer ao comportamento real do tibiarc/OTClient, em vez de ajustes pontuais.

1) Diagnóstico consolidado (causa raiz)
- O parser ainda está divergente em pontos críticos do protocolo:
  - Leitura de tiles em ordem errada (row-major), enquanto o protocolo usa x externo / y interno (column-major).
  - Em `tileSkip > 0`, o código só decrementa skip e não limpa a tile; isso deixa “lixo” antigo no mapa (montanha fantasma).
  - `floorUp/floorDown` não seguem exatamente a sequência do OTClient/tibiarc (ordem de atualizar camX/camY e offsets específicos).
  - Existem opcodes válidos não tratados (ex.: 0xF0), e alguns tratados com payload incorreto (ex.: 0xAB/0xAC/0xAD), gerando abandono de frame e estado parcial.
- O renderer também diverge:
  - Ordem de desenho de andares acima do solo está invertida em parte dos casos.
  - Pipeline por stack priority está simplificado demais; isso permite item cobrir criatura em situações em que não deveria.
  - Desenho de outfit de criatura usa apenas layer 0; players costumam depender de múltiplas camadas + tint (cores head/body/legs/feet), por isso “outfit não forma”.

2) Implementação proposta (arquivos e mudanças)
A. `src/lib/tibiaRelic/packetParser.ts` — Paridade de parsing com tibiarc
- Ajustar `readFloorArea`, `readFloorAreaWithOffset` e `readSingleFloorArea` para iterar em ordem de protocolo:
  - laço externo em X, interno em Y (equivalente ao `setFloorDescription` real).
- Corrigir comportamento de skip:
  - quando `skip > 0`, limpar explicitamente a tile (setar lista vazia) no `(x,y,z)` alvo antes de `skip--`.
- Corrigir `floorUp/floorDown` com semântica exata:
  - Atualizar `camZ` antes da leitura.
  - Ler andares usando `camX/camY` antigos.
  - Aplicar offsets do protocolo:
    - floorUp: `8 - i` (ao cruzar para z=7), `3` (underground).
    - floorDown: `-1,-2,-3` (ao cruzar para z=8), `-3` (underground profundo).
  - Só depois aplicar shift de posição:
    - floorUp: `camX++ / camY++`
    - floorDown: `camX-- / camY--`
- Completar/corrigir opcodes para eliminar abandonos de frame:
  - Adicionar 0xF0 (quest dialog) e outros opcodes leves de skip que faltam no conjunto 7.x usado nos .cam.
  - Corrigir payloads de chat/canais (0xAB/0xAC/0xAD/0xAE/0xAF) para não consumir bytes errado.
  - Manter limite de warning, mas reduzir falsos “unknown opcode”.

B. `src/lib/tibiaRelic/renderer.ts` — Pipeline de render mais fiel
- Corrigir ordem de andares visíveis:
  - Acima do solo: desenhar de `bottomVisibleFloor=7` até `topVisibleFloor` (de baixo para cima), sem inversão incorreta.
  - Underground: usar faixa visível (até `z+2`) quando aplicável, com offset NW por andar.
- Trocar ordenação simplificada por passes de tile (como no tibiarc):
  - Passo 1: itens prioridade <=2
  - Passo 2: itens prioridade 5 (ordem reversa)
  - Passo 3: criaturas
  - Passo 4: itens prioridade 3
- Isso evita cenário “nome aparece, sprite some” por sobreposição incorreta.
- Manter fallback visual de criatura caso sprite realmente não exista.

C. `src/lib/tibiaRelic/renderer.ts` — Outfit de player/NPC
- Ajustar `drawCreature` para desenhar todas as layers do outfit (não só layer 0).
- Aplicar tint de outfit quando houver layer de máscara:
  - usar `head/body/legs/feet` para colorir camadas apropriadas (modelo compatível com tibiarc).
- Resultado esperado: players deixam de parecer “não formados” mesmo quando looktype está correto.

3) Sequência de execução (para minimizar regressão)
1. Corrigir parser de tiles (ordem + clear no skip).
2. Corrigir floor transitions (offsets + timing de camX/camY).
3. Corrigir opcodes de abandono de frame.
4. Corrigir pipeline de render por prioridade.
5. Corrigir composição de outfit por layers/tint.
6. Revisar logs e remover debug excessivo mantendo apenas diagnóstico útil.

4) Critérios de validação (casos que vou usar)
- Caso da montanha (seu screenshot):
  - jogadores/NPCs devem aparecer no topo correto, sem “enterramento” visual.
- Cams com troca de andar frequente:
  - transições sem deslocamento de 1 tile e sem “andar fantasma”.
- Cams com muitos players:
  - outfits completos (sem borboleta/sem invisibilidade indevida).
- Console:
  - queda drástica de `unknown opcode` e ausência de abortos em sequência durante seek.

5) Resultado esperado para você
- A cena não “trava” visualmente em z=7/6 quando o replay muda de andar.
- Jogadores e NPCs deixam de sumir sob terreno.
- Outfit passa a ser montado de forma consistente nas cams problemáticas.
