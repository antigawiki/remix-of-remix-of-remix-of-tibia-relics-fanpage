

## Diagnóstico: SPR e DAT Loaders — Análise e Correções

### O que foi encontrado

Comparando nossos loaders (`sprLoader.ts` e `datLoader.ts`) com a implementação de referência do **Inconcessus html5-tibia-client** (Tibia 7.4/10.98), identifiquei diferenças críticas que dependem da versão do formato dos arquivos.

#### Diferenças críticas por versão

| Campo | Versão 740 (7.4) | Versão > 740 (7.5+) | Nosso código |
|-------|------------------|---------------------|-------------|
| SPR sprite count | u16 (2 bytes) | **u32 (4 bytes)** | u16 ✓/✗ |
| SPR offsets start | byte 6 | **byte 8** | byte 6 ✓/✗ |
| DAT sprite IDs | u16 (2 bytes) | **u32 (4 bytes)** | u16 ✓/✗ |
| DAT pattern Z | não existe | **u8 presente** | u8 ✓ |
| DAT animation meta | não existe | **u8+u32+i8+variável** | não lê ✗ |
| DAT flag mapping | remapeado (0x10=Light) | remapeado | direto (sem remap) |

O TibiaRelic é versão 7.72, que está entre 740 e 1000. Pelo comentário no código ("customizado com pat_z extra"), parece usar um formato **híbrido**: base 7.4 com extensões.

#### O problema dos X brancos

Na imagem do SpriteSidebar, tiles com IDs ~1020+ aparecem como X branco. Isso ocorre quando `renderSingleSprite(itemId)` retorna null — ou o item não existe no DAT, ou seus sprite IDs apontam para sprites inexistentes no SPR.

Três causas possíveis (não mutuamente exclusivas):

1. **SPR count como u16 trunca sprites**: Se o arquivo SPR tem > 65535 sprites, lemos apenas os primeiros 65535 e todos os offsets ficam errados (shift de 2 bytes na tabela)
2. **DAT animation metadata não consumida**: Se items animados têm bytes extras de animação que não lemos, todos os items seguintes ficam desalinhados
3. **DAT flag data sizes incorretos**: Se o mapeamento de flags consome bytes errados (ex: flag 0x10 deveria ler 4 bytes como Light mas lemos 0 bytes como pickupable), drift cascata

#### Evidência da verificação

A função `verify()` confirma items 102→sprite 42, 408→sprite 39, 870→sprite 559. Isso sugere que a estrutura BÁSICA do DAT está correta pelo menos até o item 870. O drift pode começar após algum item com flags ou animações não cobertas.

### Plano de implementação

#### Fase 1 — Diagnóstico automatizado nos loaders

Adicionar logging detalhado ao `sprLoader.ts` e `datLoader.ts` que detecte o formato automaticamente:

**`sprLoader.ts`**:
- Ler o signature (4 bytes) e comparar com assinaturas conhecidas (Inconcessus define `41B9EA86` = 740, `439852BE` = 760)
- Baseado na assinatura, decidir se count é u16 ou u32
- Logar: `[SprLoader] signature=XXXX, version=YYY, count=ZZZ (u16/u32), offsets_start=N`
- Se u32: ajustar offset da tabela para byte 8 em vez de byte 6

**`datLoader.ts`**:
- Ler o signature e comparar com conhecidas (`41BF619C` = 740)
- Adicionar logging extenso no readEntry: logar cada flag lida e bytes consumidos
- Após carregar todos os items, logar estatísticas: quantos items têm spriteIds válidos (>0) vs zerados
- Logar os primeiros 10 items que têm sprite IDs que excedem `spr.count` (apontam para sprites inexistentes)

#### Fase 2 — Auto-detecção de formato SPR

Modificar `sprLoader.ts` para detectar automaticamente u16 vs u32 count:

```text
Heurística:
1. Ler count como u16 (offset 4, 2 bytes)
2. Ler count como u32 (offset 4, 4 bytes)  
3. Validar: se u16_count > 0, checar se offset[0] (no byte 6) aponta para dados válidos (offset < file_size)
4. Se u32_count faz mais sentido, usar u32 e ajustar base para byte 8
```

#### Fase 3 — Verificação cruzada SPR↔DAT

Adicionar um método `diagnose()` ao `MapTileRenderer` que:
- Itera todos os items do DAT (100..maxId)
- Para cada item, verifica se TODOS os spriteIds existem no SPR (sid <= spr.count e offset != 0)
- Reporta: "X de Y items têm sprites válidos, Z items apontam para sprites inexistentes"
- Lista os primeiros 20 items com problemas

Isso nos dirá definitivamente se o problema é no SPR (offsets errados) ou no DAT (spriteIds errados).

#### Fase 4 — Correções baseadas no diagnóstico

Dependendo dos resultados:
- Se muitos sprites excedem spr.count → SPR count é u32, corrigir loader
- Se spriteIds são pequenos mas sprites retornam null → SPR offsets estão desalinhados (confirma u32 count)
- Se items após certo ID têm spriteIds absurdos → DAT parser drifta naquele ponto, investigar flags/animação

### Arquivos a modificar

1. **`src/lib/tibiaRelic/sprLoader.ts`** — Auto-detecção u16/u32, logging de diagnóstico
2. **`src/lib/tibiaRelic/datLoader.ts`** — Logging de flags, contagem de sprites válidos vs inválidos, verificação cruzada
3. **`src/lib/tibiaRelic/mapTileRenderer.ts`** — Método `diagnose()` para análise cruzada SPR↔DAT

### Resultado esperado

Logs no console que mostram exatamente:
- Qual formato o SPR usa (u16 vs u32 count)
- Quantos items do DAT têm sprites válidos
- Quais items específicos estão quebrados e por quê
- Se o fix é simples (mudar u16→u32) ou requer ajuste de flags

