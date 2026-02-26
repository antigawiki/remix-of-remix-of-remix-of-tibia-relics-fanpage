
Objetivo: fazer o player sair do “look DX5” (pixel duro) e aproximar do visual “DX9/OpenGL” (bordas/outfits mais suaves), sem quebrar a fidelidade de posição/frames que já está correta.

Diagnóstico do que está acontecendo agora
1) O problema não é o parsing do `.cam` em si  
- O parser decide “o que desenhar” (tiles, criaturas, direção, frame, etc.).  
- A diferença visual que você descreveu está no “como desenhar” (pipeline de renderização e tint de outfit).

2) Hoje o pipeline está forçando visual retro
- `src/components/TibiarcPlayer.tsx`: canvas com `style={{ imageRendering: 'pixelated' }}`.
- `src/lib/tibiaRelic/renderer.ts`: upscale final com `displayCtx.imageSmoothingEnabled = false`.
- Resultado: nearest-neighbor obrigatório (estilo “None/DX5”), mesmo em tela HiDPI.

3) Tint de outfit ainda não está no mesmo modelo do tibiarc/OTClient
- No OTClient/tibiarc, máscaras de outfit são aplicadas com multiplicação sobre a base (preserva shading/bordas).
- Nosso algoritmo atual usa heurística por canal/intensidade e “pinta por cima”, o que tende a piorar bordas e aparência do outfit.

4) Mapa de cores de outfit pode estar divergente
- No código do tibiarc (Canvas::Tint) existe tabela de paleta clássica.
- Nosso `convert8BitColor` usa cubo 6x6x6 puro; isso pode desalinhar tons e contraste dos outfits.

Plano de implementação (ordem recomendada)

Fase 1 — Garantir que a mudança visual seja perceptível imediatamente
Arquivos:
- `src/components/TibiarcPlayer.tsx`
- `src/lib/tibiaRelic/renderer.ts`

Ações:
1. Remover o hard-force de pixelização CSS do canvas (`imageRendering: 'pixelated'`).
2. Introduzir “modo de qualidade” no player (controle visível):
   - `Classic` (visual atual / nearest)
   - `Enhanced` (smoothing moderno)
3. No renderer, aplicar upscale final por modo:
   - Classic: `imageSmoothingEnabled = false`
   - Enhanced: `imageSmoothingEnabled = true` + `imageSmoothingQuality = 'high'`
4. Manter DPR atual (já está correto), mas com smoothing opcional no passo final.

Resultado esperado:
- Você verá diferença real ao alternar modo (sem depender de “parece que não mudou”).

Fase 2 — Corrigir tint de outfit para ficar próximo do tibiarc/OTClient
Arquivo:
- `src/lib/tibiaRelic/renderer.ts`

Ações:
1. Substituir a estratégia atual de tint por pipeline de multiplicação:
   - Base layer desenhada normalmente.
   - Máscara de outfit aplicada com composição tipo multiply no mesmo retângulo.
2. Trocar detecção heurística por mapeamento explícito das máscaras:
   - amarelo=head, vermelho=body, verde=legs, azul=feet
3. Preservar transparência e contorno do sprite (sem “chapar” cor).

Resultado esperado:
- Outfits com sombra/volume mais naturais, bordas menos “duras” e menos artefatos.

Fase 3 — Alinhar paleta de cor de outfit com cliente de referência
Arquivo:
- `src/lib/tibiaRelic/renderer.ts`

Ações:
1. Implementar paleta clássica compatível com tibiarc para índices de outfit.
2. Fallback controlado para índices fora da faixa esperada.
3. Centralizar isso em utilitária única (sem lógica duplicada em tint).

Resultado esperado:
- Tons de outfit mais fiéis ao cliente original.

Fase 4 — Limpeza e verificação objetiva
Arquivos:
- `src/lib/tibiaRelic/datLoader.ts` (remover logs de debug ruidosos)
- (opcional) `src/i18n/translations/*.ts` e `src/i18n/types.ts` para labels do seletor de qualidade

Ações:
1. Remover logs de diagnóstico que poluem console.
2. Validar com o mesmo `.cam` que você enviou em 3 checkpoints:
   - screenshot no modo Classic
   - screenshot no modo Enhanced
   - close-up de criatura com outfit colorido

Critérios de aceite
1) Alternar Classic/Enhanced muda o visual de forma clara.  
2) No Enhanced, bordas e outfits ficam mais “lisas” e menos serrilhadas/estouradas.  
3) Não reintroduzir corte de criaturas nem desalinhamento de HUD.  
4) Performance permanece estável no replay normal.

Riscos e mitigação
- Risco: blur excessivo em alguns monitores no Enhanced.  
  Mitigação: manter modo Classic disponível e fácil de trocar.
- Risco: custo de CPU ao aplicar tint por multiplicação.  
  Mitigação: cache agressivo por sprite+cores e invalidação mínima.

Resumo prático
O motivo de “nada mudou” é que o pipeline ainda estava essencialmente travado no visual retro (nearest + pixelated), e o tint de outfit ainda não segue o mesmo modelo do tibiarc/OTClient.  
Com esse plano, a diferença visual aparece de imediato (Fase 1) e depois a fidelidade de outfits/bordas sobe de verdade (Fases 2 e 3).
