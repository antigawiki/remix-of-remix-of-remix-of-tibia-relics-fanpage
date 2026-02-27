
Resumo do diagnóstico (comparado com OTClient/tibiarc e com os logs atuais):

1) Regressão principal de fluidez: o offset de câmera foi aplicado com sinal incorreto no renderer, e o player recebe deslocamento duas vezes (câmera + walk próprio).  
- No OTClient: cálculo equivalente é “posição da criatura - drawOffset da câmera + drawOffset da criatura”, o que cancela o offset do player seguido (ele fica estável) e move o mapa suavemente.
- No estado atual: offsets somam no mesmo sentido, causando “pulos”, sensação de travamento e sumiço intermitente.

2) Duração de walk diagonal foi aplicada de forma incompatível com a referência para animação visual.  
- No OTClient, a atualização visual usa `getStepDuration(true)` (ignora multiplicador diagonal na interpolação visual).  
- Hoje está multiplicando por 3 no parser para diagonal, o que deixa passos inconsistentes e “arrastados”.

3) Move de criatura ainda está frágil versus formato real de protocolo.  
- Referência usa `getMappedThing`: pode vir por `pos+stack` ou por `0xFFFF + creatureId`.  
- Parser atual assume apenas `pos+stack`, o que pode falhar em certos frames e contribuir para criaturas/player “sumirem”.

4) Gargalo de UI após liberar 60fps: `setProgress` em toda frame força re-render React contínuo.  
- Isso piora jank perceptível mesmo com renderer canvas funcionando.

5) Log recorrente `[PacketParser] Unknown opcode 0x63 ...` mostra perda de sincronização em alguns frames (especialmente seek), gerando abort de frame e estado visual quebrado.

Plano de correção (ordem de execução):

Fase 1 — corrigir regressões críticas de movimento/câmera  
- `src/lib/tibiaRelic/renderer.ts`
  - inverter a aplicação do offset global da câmera (usar equivalente ao “-drawOffset” da referência);
  - manter offset próprio da criatura separado;
  - ajustar HUD para usar a mesma lógica (evitar duplo offset no player).
- `src/lib/tibiaRelic/packetParser.ts`
  - remover multiplicador diagonal da duração visual do walk (alinhado a `getStepDuration(true)` do OTClient para interpolação).

Fase 2 — robustez de protocolo (sumiço de criatura/player e drift)  
- `src/lib/tibiaRelic/packetParser.ts`
  - suportar `moveCr` no formato alternativo `0xFFFF + creatureId` além de `fromPos+stack`;
  - adicionar fallback seguro quando `stackpos` não bate (sem quebrar frame inteiro);
  - tratar opcodes ausentes relevantes (ex.: walk-wait) para reduzir “unknown opcode”.
- manter abort de frame em erro grave, mas com estratégia de recuperação menos destrutiva para eventos não críticos.

Fase 3 — fluidez real no frontend  
- `src/components/TibiarcPlayer.tsx`
  - desacoplar atualização visual do canvas da atualização de estado React;
  - “throttle” de `setProgress` (ex.: 8–12Hz) para evitar re-render 60fps;
  - preservar seek/play responsivos sem sacrificar fps.

Fase 4 — validação técnica completa  
- Teste A/B com .cam problemática e uma .cam estável:
  - caminhada reta e diagonal;
  - transição de tela durante walk do player;
  - floor up/down;
  - seek repetido em região com erro anterior (49:xx);
  - confirmar ausência de sumiço de player/creaturas.
- Confirmar nos logs:
  - queda drástica de `Unknown opcode 0x63`;
  - ausência de “camera jump” perceptível;
  - frame pacing mais estável.

Detalhes técnicos (referência open source usada):
- MapView do OTClient aplica offset de câmera do jogador seguido no “source rect” (equivalente a subtrair no espaço de render).
- Draw de criatura aplica `getDrawOffset()` (walk próprio) separadamente.
- Fórmula visual de walk usa step duration sem penalidade diagonal na interpolação frame-a-frame.
- Parse de movimento usa `getMappedThing` (suporta posicional e por id), evitando perda de entidade em casos de stack mismatch.

Resultado esperado após implementação:
- transição de cena suave junto com o walk, sem “travar a tela”;
- player e criaturas não desaparecendo durante deslocamento;
- redução forte de stutter percebido;
- seek menos propenso a quebrar estado por frame abortado.
