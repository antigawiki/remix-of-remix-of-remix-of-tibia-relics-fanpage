

## Diagnostico: Por que o WASM continua crashando e corrompendo

### Causa raiz

O problema NAO e falta de try-catch. O erro `RuntimeError: memory access out of bounds` e um **trap do WebAssembly** — ele acontece quando o parser C++ do tibiarc tenta ler memoria fora dos limites de um buffer. Traps WASM NAO podem ser capturados por try-catch C++, mesmo com `-fexceptions`. Eles sao convertidos em `RuntimeError` no JavaScript.

O parser C++ do tibiarc foi escrito para formatos `.cam` padrao (TibiaCast, etc) e nao entende as particularidades do protocolo TibiaRelic 7.72. O parser JS (`packetParser.ts`) foi extensivamente customizado para este protocolo (handlers especificos de opcodes, heuristicas de TCP vs opcode direto, tratamento de looktype u16, etc). O parser C++ nao tem nenhuma dessas customizacoes.

Isso explica os dois sintomas:
- **Crash no seek**: O parser C++ le bytes alem do buffer ao encontrar um pacote que nao reconhece
- **Corrupcao visual**: O parser C++ interpreta pacotes errados (outfit trocado = leu bytes errados para outfit; criatura duplicada = criou nova criatura em vez de atualizar existente; camera em andar errado = leu floor change incorretamente)

### Solucao: Melhorar a recuperacao de seek no JS

Como nao podemos corrigir o parser C++ (ele e da biblioteca tibiarc), a melhor abordagem e tornar a recuperacao de seek mais inteligente no lado JavaScript:

1. **Quando seek falha, pular a area problematica** — em vez de tentar o mesmo ponto (que vai crashar de novo), avanca 10 segundos alem do ponto solicitado
2. **Se ainda falhar, tentar posicoes progressivamente mais distantes** — +20s, +30s
3. **Se tudo falhar, voltar para a ultima posicao boa** (comportamento atual)
4. **Adicionar `INITIAL_MEMORY=512MB`** no build para reduzir chance de out-of-bounds em gravacoes longas

### Mudancas

**1. `src/components/TibiarcPlayer.tsx` — handleSeek melhorado:**

```text
handleSeek(ms):
  1. Tenta seek(ms) 
  2. Se falhar: reload + seek(ms + 10000)     // pula 10s
  3. Se falhar: reload + seek(ms + 30000)     // pula 30s  
  4. Se falhar: reload + seek(lastGoodProgress) // volta ao seguro
  5. Mostra toast informando que pulou area problematica
```

**2. `.github/workflows/build-tibiarc.yml` — aumentar memoria inicial:**

Mudar `TOTAL_MEMORY=268435456` (256MB) para `TOTAL_MEMORY=536870912` (512MB) para dar mais espaco ao parser e reduzir chance de out-of-bounds.

**3. `tibiarc-player/web_player.cpp` — proteger `RenderFrame` contra out-of-bounds:**

Adicionar validacao antes do render para evitar que um gamestate corrompido cause crash na renderizacao tambem.

### Limitacao conhecida

A corrupcao visual (outfits trocados, criaturas duplicadas) durante reproducao normal em 8x e uma limitacao inerente do parser C++ tibiarc com arquivos TibiaRelic. Para resolver isso de verdade, seria necessario usar o parser JS para processar os pacotes e o WASM apenas para renderizar — uma mudanca arquitetural muito maior que pode ser feita no futuro.

### Resumo das mudancas

| Arquivo | Mudanca |
|---|---|
| `src/components/TibiarcPlayer.tsx` | Seek recovery com skip progressivo (+10s, +30s) em vez de retry no mesmo ponto |
| `.github/workflows/build-tibiarc.yml` | TOTAL_MEMORY de 256MB para 512MB |
| `tibiarc-player/web_player.cpp` | Guard no RenderFrame contra gamestate invalido |

### Apos as edicoes

Sera necessario rodar o workflow **"Build tibiarc WASM Player"** no GitHub Actions para gerar novos .wasm e .js com a memoria aumentada, e depois subir os arquivos aqui.

