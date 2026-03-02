

## Fix: Recuperacao apos falha de seek no WASM

### Problema raiz

O `seek` no C++ faz `g_gamestate->Reset()` e re-processa todos os frames ate o ponto desejado. Se qualquer frame causa uma excecao, o gamestate fica corrompido e o player congela. O `safeCall` captura a excecao no JS, mas o estado interno do WASM ja esta inconsistente -- o canvas para de atualizar.

Sem recompilar o WASM, nao da para corrigir isso no C++. A solucao e tratar no JS.

### Solucao: Recuperacao automatica apos falha de seek

**Arquivo: `src/components/TibiarcPlayer.tsx`**

1. **Guardar o buffer do arquivo .cam em um ref** (`camBufferRef`) para poder recarregar sem pedir o arquivo de novo

2. **Na funcao `handleSeek`**: apos chamar `safeCall(mod, 'seek', ...)`, verificar se retornou o fallback (indicando excecao). Se sim:
   - Recarregar o recording chamando `load_recording_tibiarelic` novamente com o buffer salvo
   - Tentar seek de novo (uma unica vez)
   - Se falhar de novo, manter a posicao atual e continuar playback normal

3. **Skip forward/back (-10s/+10s)**: mesma logica de recuperacao

4. **Seek somente para frente quando possivel**: se o ponto desejado e maior que o atual, o C++ nao precisa fazer reset (so avanca frames). Isso evita o caminho de codigo que causa crash. Adicionar logica para detectar isso e so recarregar quando o seek for para tras.

### Mudancas

| Arquivo | Mudanca |
|---|---|
| `src/components/TibiarcPlayer.tsx` | Adicionar `camBufferRef` para guardar dados do .cam; modificar `handleSeek` para detectar falha e recarregar recording; logica de retry com limite de 1 tentativa |

### Detalhes da implementacao

```text
handleSeek(ms):
  1. Se ms >= progresso_atual -> seek forward (seguro, sem reset)
  2. Se ms < progresso_atual -> seek backward (perigoso)
     a. Chamar seek via safeCall
     b. Se falhar (retorna fallback):
        - Re-chamar load_recording_tibiarelic com camBufferRef
        - Tentar seek novamente
        - Se falhar de novo, desistir e manter posicao atual
     c. Sempre restaurar playback se estava tocando
```

