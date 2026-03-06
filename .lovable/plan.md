

# Plano: Correção do Parser DAT com Detecção Inteligente de Payloads

## Diagnóstico

O problema central está na **Phase 1 do datLoader** (linhas 160-164): ela varre byte a byte procurando `0xFF` como terminador de atributos, **sem entender os payloads das flags**. Isso significa que se qualquer flag tiver um payload cujo valor seja `0xFF`, o scanner para prematuramente, corrompendo o alinhamento da leitura das dimensões e sprites daquele item.

Além disso, o validador considera "inválidos" itens com `anim > 8` ou `patX/patY > 4`, mas esses valores são perfeitamente normais para outfits e itens animados do Tibia 7.72 (ex: tochas com 16 frames). Isso infla artificialmente os "161 items inválidos".

## Mudanças Planejadas

### 1. Substituir scanner cego por parser de flags correto no datLoader

Trocar a Phase 1 (scan byte-a-byte por 0xFF) por um parser que entende os payloads de cada flag — idêntico ao que o `datValidator` já faz nas hipóteses. Isso elimina o risco de falso-positivo em 0xFF dentro de payloads.

**Arquivo:** `src/lib/tibiaRelic/datLoader.ts`
- Criar mapa estático `FLAG_PAYLOADS` com o tamanho correto de cada flag
- Substituir o loop cego da Phase 1 pelo loop inteligente que consome os bytes de payload de cada flag antes de procurar o próximo
- Manter fallback: se encontrar uma flag desconhecida (>0x1D e não no mapa), fazer scan-to-0xFF como último recurso

### 2. Relaxar critérios de validação no datValidator

**Arquivo:** `src/lib/tibiaRelic/datValidator.ts`
- `rawAnim`: aceitar 1-32 (não 1-8)
- `rawPatX/patY`: aceitar 1-8 (não 1-4)
- `rawLayers`: aceitar 1-8 (não 1-3)
- `rawW/rawH`: aceitar 1-8 (não 1-4)

### 3. Adicionar hipóteses combinadas ao validador

Testar combinações de flags que podem ter payloads diferentes simultaneamente (ex: 0x07=u16 + 0x1C/1D=u32), não apenas uma variação por vez. Adicionar 2-3 hipóteses combinadas para identificar a configuração exata.

### 4. Diagnóstico aprimorado dos bad items

Para cada item com dimensões estranhas, mostrar a sequência exata de flags lidas e seus payloads, facilitando a identificação visual de onde o drift começa.

## Impacto Esperado

A correção do scanner de flags no datLoader garante que **todos os items sejam lidos com alinhamento correto**, eliminando sprites "vazios" causados por drift de bytes. Isso pode resolver os problemas de renderização nas cams, já que items com sprites errados produzem tiles invisíveis ou corrompidos no mapa.

