

## Corrigir Outfits Ausentes e Cores Erradas

### Problema 1: Paleta de Cores Totalmente Errada

A paleta de cores no codigo (`OUTFIT_PALETTE`) foi escrita manualmente com valores incorretos. O Tibia usa um algoritmo HSI-to-RGB com 133 cores (19 matizes x 7 niveis), documentado no codigo fonte do OTClient (`outfit.cpp`).

**Exemplo da diferenca:**
- Nosso indice 1: `[255,212,191]` (um tom de pele)
- OTClient indice 1: HSI com hue=1/18, sat=0.25, int=1.0 -> `[255,239,191]` (tom levemente amarelado)

A paleta inteira esta desalinhada porque o layout e linear por grupos de 19 (cada coluna de matiz), nao por grupos de 5.

**Correcao:** Substituir a tabela fixa pela funcao `getOutfitColor(index)` que implementa o **mesmo algoritmo HSI** do OTClient:
- `HSI_H_STEPS = 19` (matizes por grupo)
- `HSI_SI_VALUES = 7` (niveis de saturacao/intensidade)
- Indices multiplos de 19: escala de cinza
- Demais: conversao HSI -> RGB com 6 faixas de matiz

### Problema 2: Outfits Nao Aparecem em Algumas Criaturas

Analise das screenshots mostra criaturas com nome/barra de vida mas sem sprite visivel (Vermonth, scarab). O retangulo de fallback (colorido semi-transparente) pode estar se confundindo com o fundo de areia.

**Causas identificadas:**
1. O looktype da criatura pode nao existir no DAT (ID fora do range de outfits carregados). `this.dat.outfits.get(c.outfit)` retorna `undefined`, pula renderizacao.
2. O sprite ID calculado pode ser 0 para certas combinacoes de direcao/frame, fazendo `getNativeSprite(0)` retornar null.
3. O fallback visual (retangulo rgba 0.6) e quase invisivel contra fundos claros como areia.

**Correcoes:**
1. **Fallback mais visivel**: Trocar retangulo semi-transparente por um contorno solido + X dentro, visivel contra qualquer fundo.
2. **Log de diagnostico**: Quando outfit nao e encontrado no DAT, logar uma vez por outfit ID para ajudar a diagnosticar.
3. **Bounds checking**: Quando sprite index ultrapassa o array, tentar frame 0 como fallback antes de desistir.

### Problema 3: Tint pode falhar silenciosamente

O algoritmo de tint atual usa heuristica de "canal dominante" (amarelo=head, vermelho=body, verde=legs, azul=feet). Se a mascara tiver pixels com cores mistas ou baixa intensidade, o pixel e descartado (alpha=0). Isso pode "apagar" partes do outfit colorido.

**Correcao:** Relaxar os thresholds de deteccao de canal para aceitar mais pixels como parte da mascara, e tratar pixels ambiguos como "body" (canal mais comum) em vez de descarta-los.

### Mudancas por Arquivo

**`src/lib/tibiaRelic/renderer.ts`**
1. Substituir `OUTFIT_PALETTE` + `convert8BitColor()` pela funcao `getOutfitColor(color)` baseada no algoritmo HSI do OTClient
2. Melhorar fallback visual para criaturas sem sprite
3. Adicionar fallback de frame (tentar frame 0 se frame atual nao tem sprite)
4. Relaxar thresholds do tint para melhor cobertura de mascara
5. Log de warning (limitado) quando outfit ID nao encontrado no DAT

### Detalhes Tecnicos do Algoritmo HSI

```text
HSI_H_STEPS = 19
HSI_SI_VALUES = 7

getOutfitColor(color):
  if color >= 133: color = 0
  
  if color % 19 == 0:     // Grayscale
    intensity = 1 - (color/19) / 7
    return RGB(intensity*255, intensity*255, intensity*255)
  
  hue = (color % 19) / 18.0
  group = floor(color / 19)
  
  // Saturacao e intensidade por grupo:
  // 0: sat=0.25, int=1.00  (mais claro, menos saturado)
  // 1: sat=0.25, int=0.75
  // 2: sat=0.50, int=0.75
  // 3: sat=0.667, int=0.75
  // 4: sat=1.00, int=1.00  (vivo)
  // 5: sat=1.00, int=0.75
  // 6: sat=1.00, int=0.50  (mais escuro)
  
  // HSI -> RGB com 6 faixas de matiz (padrao)
```

