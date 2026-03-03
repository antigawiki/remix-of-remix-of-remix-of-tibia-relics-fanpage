
## Fix: Tela preta ao voltar de area problematica no cam player

### Causa raiz

Dois bugs no sistema de seek:

1. **Deteccao de falha quebrada**: O C++ `seek()` retorna `void`, mas o JavaScript chama com tipo de retorno `'string'` e compara com um sentinela `SEEK_FAIL`. Como `void` retorna `undefined` (nunca igual a `SEEK_FAIL`), o seek SEMPRE parece ter sucesso. A logica de retry/recuperacao nunca executa.

2. **Reset incompleto**: O `g_gamestate->Reset()` no C++ pode nao limpar todo o estado interno. Apos processar frames corrompidos (area ~1:10:00), a corrupcao persiste mesmo fazendo Reset e reprocessando ate o minuto 48.

### Solucao

Mudar a estrategia de seek no JavaScript para **sempre recarregar a gravacao** antes de qualquer seek. O `reloadRecording()` chama `load_recording_tibiarelic` no C++, que cria um `Gamestate` totalmente novo (`std::make_unique<Gamestate>`). Isso garante estado 100% limpo.

### Mudancas em `src/components/TibiarcPlayer.tsx`

**Substituir o `handleSeek`** para:

1. **Sempre chamar `reloadRecording(mod)`** antes do seek, nao apenas nos retries
2. **Remover a deteccao de falha baseada em retorno** (seek retorna void, nao tem como detectar falha pelo retorno)
3. **Usar try-catch** para detectar se o seek crashou (excecao WASM)
4. **Manter `lastGoodProgressRef`** para fallback se o seek causar excecao

Logica simplificada:

```text
1. Pausar playback
2. Recarregar gravacao (estado limpo)
3. Tentar seek para posicao desejada
4. Se excecao: recarregar + seek para lastGoodProgress
5. Retomar playback se estava tocando
```

Isso elimina completamente o problema de "estado corrompido persistente" porque cada seek comeca de um estado virgem.

### Impacto em performance

O `reloadRecording` re-parseia a gravacao inteira, mas isso leva menos de 100ms mesmo para arquivos grandes (o console mostra parsing de 26k frames quase instantaneo). O debounce de 150ms ja absorve esse custo.
