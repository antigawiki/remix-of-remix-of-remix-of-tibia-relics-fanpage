
Objetivo: corrigir dois problemas que ainda aparecem em algumas .cam (como a que você enviou):  
1) floor/câmera “derivando” depois de alguns minutos (área escura subindo),  
2) outfit de monstros inconsistentes.

Diagnóstico consolidado (com base no código atual + referência OT/tibiacast):
- A lógica de mudança de andar (0xBE/0xBF) no projeto está muito próxima da referência; o comportamento visual indica mais “dessincronização do stream” do que fórmula de floor errada.
- O parser atual tem mecanismos agressivos que podem introduzir drift:
  - fallback dinâmico de looktype u8/u16 por criatura,
  - troca automática de modo em runtime,
  - recuperação por “pular 1 byte e continuar” em opcodes desconhecidos.
- Na referência (tibiacast/OT-like), leitura de outfit é determinística por versão:
  - para 7.72, looktype é u16;
  - não há troca adaptativa de largura no meio da sessão.
- Sobre DAT: na referência, ZDiv (patZ) é feature de versão (>=7.55), aplicada nas categorias do type file; isso sugere que o caminho “patZ para tudo” não é, por si só, a causa principal do bug atual.
- As imagens enviadas (faixa escura subindo + borda lateral repetida) são compatíveis com drift de posição/camZ após parsing desalinhado.

Plano de implementação

1) Fixar protocolo de outfit para TibiaRelic (determinístico)
- Arquivo: `src/components/TibiarcPlayer.tsx`
- Remover a detecção heurística de modo u8/u16 para .cam TibiaRelic.
- Inicializar `PacketParser` sempre em modo u16 para looktype/outfit-window nesse player.
- Resultado esperado: elimina leitura intermitente de looktype com largura errada.

2) Simplificar `readOutfit` no parser (sem fallback adaptativo)
- Arquivo: `src/lib/tibiaRelic/packetParser.ts`
- Remover:
  - fallback alternando u8/u16 por criatura,
  - contadores/hits e auto-swap de modo.
- Manter leitura estrita:
  - `outfitId` no formato fixo do protocolo da sessão,
  - `id===0` trata outfit por item,
  - 4 cores em sequência.
- Resultado esperado: evitar consumo de bytes inconsistente dentro de updates de criatura (principal fonte de outfit “trocado”).

3) Tornar leitura de buffer estrita (falha rápida, sem lixo silencioso)
- Arquivo: `src/lib/tibiaRelic/buf.ts`
- Adicionar checagem de limites em `u8/u16/u32/str16` e lançar erro com contexto (posição/tamanho restante) quando faltar dado.
- Hoje `u8` fora de faixa pode retornar valor inválido sem exceção; isso favorece drift silencioso.
- Resultado esperado: erro controlado em frame ruim, sem contaminar estado global.

4) Mudar estratégia de recuperação de erro para nível de pacote/frame (não byte a byte)
- Arquivo: `src/lib/tibiaRelic/packetParser.ts`
- Substituir recuperação por “skip 1 byte” em loop por abordagem mais segura:
  - ao detectar opcode inválido/erro de bounds, abortar o restante do pacote/frame atual;
  - retomar no próximo frame normalmente.
- Manter logging diagnóstico com limite para não poluir console.
- Resultado esperado: evitar que um erro local se transforme em sequência de opcodes falsos (incluindo floor up/down fantasma).

5) Guard-rails de câmera/floor para impedir estado impossível
- Arquivo: `src/lib/tibiaRelic/packetParser.ts`
- Em `floorUp/floorDown` e opcode de posição (`0x9A`), aplicar clamp de `camZ` para [0..15].
- Se ocorrer tentativa de ultrapassar limite, registrar warning e ignorar ajuste inválido.
- Resultado esperado: mesmo com frame ruim, não deixa `camZ` escapar e “arrastar” renderização inteira.

6) Verificação específica do problema reportado + outfit de monstros
- Testar primeiro com `Exploração_Ank.cam` e `2026-02-20-07-31-15-2.cam`:
  - ponto crítico após ~03:00 e trecho ~05:20 (onde começa a faixa escura),
  - confirmar que o floor não deriva e não vira valor impossível.
- Confirmar outfits:
  - checar logs de looktype/cores em criaturas visíveis,
  - validar que o ID lido corresponde a outfit existente no DAT sem fallback “mágico”.
- Se restar divergência pontual:
  - adicionar log temporário de “último opcode válido + posição no payload” para identificar pacote específico que quebra.

Sequenciamento recomendado
1. Fixar modo u16 no player e remover auto-swap/fallback de outfit.  
2. Endurecer `Buf` com bounds checks.  
3. Trocar recuperação de erro para abortar pacote/frame.  
4. Adicionar clamps/guard-rails de `camZ`.  
5. Rodar validação com as cams problemáticas e ajustar logs temporários.

Riscos e mitigação
- Risco: abortar frame em erro pode causar pequenos “saltos” visuais em gravações corrompidas.
  - Mitigação: melhor salto pontual do que drift progressivo que destrói a cena inteira.
- Risco: algumas .cam fora do perfil TibiaRelic dependerem de heurística antiga.
  - Mitigação: manter esse player explicitamente focado em TibiaRelic 7.72; se necessário, criar modo alternativo manual no futuro.
- Risco: regressão em arquivo que hoje “funciona por sorte”.
  - Mitigação: validar em lote com cams conhecidas (boas e ruins) antes de encerrar.

Detalhe técnico importante da sua suspeita (“talvez o ID esteja trocado”)
- Pela referência de parser OT/tibiacast, não há tabela de “ID trocado” para monstros nesse ponto; o problema típico é largura de leitura (u8 vs u16) e consumo incorreto de bytes.  
- Portanto, o foco correto é estabilizar o parsing de aparência/pacotes, não aplicar offset manual de IDs de outfit.
