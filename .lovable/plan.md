
Objetivo: eliminar o sumiço intermitente do player com correção de protocolo + consistência de estado, alinhado ao comportamento de clientes open source (OTClient/tibiarc).

Diagnóstico aprofundado (comparação com open source):
1) `moveCr` no formato `0xFFFF + creatureId` está incorreto no parser atual.
- Referência (OTClient `getMappedThing` e tibiarc `ParseTileMoveCreature`): quando `x == 0xFFFF`, lê `u32 creatureId` e move por ID.
- Atual: lê como `pos3 + stack`, tenta achar criatura por destino e calcula `dx = tx - 65535`, gerando offsets absurdos e perda visual (player “some”).

2) Divergência de opcodes 7.72 relevantes:
- tibiarc trata `0x1D` (pingback), `0xB6` (move delay), `0xB7`, `0xB8`, `0xDD`.
- Parser atual ignora alguns deles, causando `Unknown opcode` e aborto de frame (perda de updates).

3) Mutação de câmera antes de validar payload em opcodes de mapa:
- `scroll/floorUp/floorDown` já alteram `camX/camY/camZ` antes da leitura de tiles.
- Em pacote inválido/parcial isso deixa estado “quebrado” (player fora da viewport).

Plano de implementação:

Arquivos:
- `src/lib/tibiaRelic/packetParser.ts`
- (validação apenas) `src/lib/tibiaRelic/renderer.ts`

Fase 1 — Correção crítica de movimento por ID:
- Reescrever `moveCr` para suportar dois formatos exatamente:
  - A) `fromPos + stack + toPos`
  - B) `0xFFFF + creatureId + toPos`
- No formato B: obter `from` pelo estado atual da criatura (`c.x/c.y/c.z`) e remover corretamente do tile antigo.
- Atualizar direção e walk offset usando `from real -> to`, nunca com `fx=65535`.

Fase 2 — Sincronização robusta tile<->creature:
- Adicionar helper interno para remover `cid` de qualquer tile anterior conhecido antes de inserir no destino (deduplicação defensiva).
- Garantir invariantes: criatura em no máximo 1 tile visível por vez; sem “fantasmas” de stack antigo.

Fase 3 — Paridade de opcodes 7.72 (tibiarc):
- Implementar/ignorar corretamente: `0x1D`, `0xB6`, `0xB7`, `0xB8`, `0xDD` (skip seguro conforme tamanho esperado).
- Reduzir abortos de frame por opcodes válidos ainda não tratados.

Fase 4 — Segurança transacional para câmera:
- Em `scroll/floorUp/floorDown`, aplicar atualização de câmera somente após leitura mínima válida de mapa.
- Em falha/parcial, não “commitar” deslocamento de câmera.

Fase 5 — Validação detalhada:
- Reproduzir com .cam problemática em playback normal e seek.
- Verificar:
  - player não some em transições prolongadas;
  - queda clara de `Unknown opcode`;
  - ausência de drift de câmera após erro de parse;
  - sem regressão no fix de z-order (tiles x player).

Resultado esperado:
- desaparecimento do player eliminado nos momentos intermitentes;
- estado de mapa/criaturas estável mesmo com frames problemáticos;
- comportamento alinhado ao fluxo usado em OTClient/tibiarc para `move creature` por ID.
