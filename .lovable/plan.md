
Objetivo: eliminar de vez a “transparência” de players/NPCs/monstros e corrigir sprites errados, alinhando o player TS com o comportamento real do tibiarc/OTClient (render e parsing).

Resumo da investigação (fontes comparadas):
1) OTClient (`thingtype.cpp` + `creature.cpp`)
- Outfit não usa paleta HSL de 133 cores.
- O fluxo real é:
  - desenha layer base
  - aplica máscaras com composição multiplicativa
  - mapeamento de partes: Head ← máscara amarela, Body ← vermelha, Legs ← verde, Feet ← azul.
2) tibiarc oficial (`lib/renderer.cpp`)
- O renderer usa cor 8-bit (6x6x6), via `Convert8BitColor`, não HSL.
- Para criaturas com `LayerCount == 2`: desenha base (layer 0) + `TintType` (layer 1).
- Isso confirma que nosso pipeline de tint atual está incompatível.
3) tibiarc oficial (`lib/renderer.cpp` + `lib/versions.cpp`)
- A lógica de “top visible floor” não é só `isGround`.
- Ela considera bloqueio visual por stack priority (inclui prioridade 2), `DontHide` e checagens diagonais específicas.
4) tibiarc parser (`lib/parser.cpp`)
- `0x61/0x62/0x63` são marcadores de objeto/criatura no parsing de objeto; qualquer leitura alternativa precisa ser extremamente defensiva para não desalinha payload.
- Em versões 7.72, vários detalhes de protocolo divergem de heurísticas simplificadas.

Causas mais prováveis no código atual:
1) Pipeline de cor/tint incorreto
- A tabela HSL e o mapeamento atual de canais não batem com a referência.
- O algoritmo atual zera alpha em muitos pixels “não reconhecidos”, gerando efeito fantasma em certas combinações de outfit.
2) Lógica de visibilidade de floors ainda simplificada
- `tileCoversFloor` baseado só em `isGround` perde casos de cobertura de teto/paredes com outra prioridade.
3) Dessincronização ocasional em criaturas
- Tratamento de opcodes de criatura precisa ficar resiliente (parse defensivo com validação) para não deslocar leitura e produzir looktypes/sprites errados.

Plano de implementação (arquivos e mudanças):

1) Corrigir tint de outfit para bater com tibiarc/OTClient
Arquivo: `src/lib/tibiaRelic/renderer.ts`

1.1 Substituir paleta HSL por conversão 8-bit
- Remover `OUTFIT_COLORS`, `buildOutfitColorTable`, `getOutfitColor`, `hslToRgb`.
- Criar `convert8BitColor(color: number): [number, number, number]` equivalente ao tibiarc (`(color/36)*51`, etc., clamp 0..255).

1.2 Corrigir mapeamento de partes de máscara
- Ajustar para o padrão clássico:
  - Head = Yellow
  - Body = Red
  - Legs = Green
  - Feet = Blue

1.3 Corrigir algoritmo de tint para não “vazar transparência”
- Em vez de “substituir RGB puro e zerar tudo que não bate”, aplicar tint multiplicativa preservando intensidade/alpha da máscara.
- Não apagar agressivamente pixels de anti-alias (evita buracos no outfit).

1.4 Ajustar fluxo de layers de criatura
- Manter base em layer 0.
- Se `layers >= 2`, tratar layer 1 como máscara colorizável.
- Para casos fora do padrão, fallback seguro: desenhar layers restantes sem quebrar (evita monstro com sprite faltando).

2) Corrigir cálculo de floors visíveis (casas/interior)
Arquivos:
- `src/lib/tibiaRelic/renderer.ts`
- `src/lib/tibiaRelic/datLoader.ts`

2.1 Enriquecer flags de tipo no DAT
- Adicionar flag booleana de “dontHide” no `ItemType` e preencher ao ler atributo correspondente.

2.2 Melhorar `tileCoversFloor`
- Passar a considerar cobertura visual por stack priority relevante (incluindo prioridade 2) e `!dontHide`, não apenas `isGround`.

2.3 Refinar `calcFirstVisibleFloor`
- Alinhar com o comportamento observado no tibiarc:
  - checagem direta + diagonal
  - regras de bloqueio visual por tile
  - evitar desenhar andares superiores quando interior deve aparecer.

3) Blindar parsing de criaturas para evitar sprites trocados
Arquivo: `src/lib/tibiaRelic/packetParser.ts`

3.1 Tornar parsing de `0x61/0x62/0x63` defensivo
- Implementar leitura com validação/sanity check e rollback local quando formato não bater.
- Evitar qualquer consumo irreversível de bytes quando marcador/estrutura não for a esperada.

3.2 Adicionar sanidade de outfit/looktype
- Validar looktype lido contra `dat.outfits`.
- Se valor impossível aparecer após opcode específico, registrar diagnóstico e tentar caminho alternativo sem contaminar frame inteiro.

3.3 Preservar estabilidade de frame
- Melhorar recuperação para impedir “efeito cascata” (um parse errado gerando sprites errados em vários monstros).

4) Diagnóstico temporário guiado (durante correção)
Arquivos:
- `renderer.ts`
- `packetParser.ts`

- Logs curtos e limitados (1x por sessão) para:
  - layerCount real dos outfits renderizados,
  - índices/máscaras usados,
  - quantidade de looktypes inválidos por frame.
- Depois de confirmar fix, limpar logs temporários.

Validação (aceite):
1) Testar com o mesmo `.cam` que hoje reproduz:
- player com combinações diferentes de outfit (incluindo cores extremas),
- NPCs e monstros na mesma cena.
2) Confirmar:
- sem transparência fantasma em qualquer combinação,
- monstros não “trocam de sprite” ao longo da timeline,
- interior de house aparece corretamente (sem teto indevido por cima).
3) Regressão rápida:
- zonas abertas (surface) e underground continuam com ordenação correta de floors.

Resultado esperado:
- Render de criaturas consistente com referência (tibiarc/OTClient),
- fim do bug de transparência por combinação de outfit,
- eliminação dos casos de sprite errado decorrentes de parse desalinhado e cobertura de floor incompleta.
