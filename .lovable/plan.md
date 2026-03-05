## GPT Creature ID Tracking — Status: REJEITADO ✅

### Decisão
O código do GPT foi analisado e **não será implementado** — ele cria um registro paralelo desconectado do renderer. Nossa `SanitizeCreatureState` já implementa a mesma estratégia diretamente no gamestate real.

### Próximo passo
Se fantasmas/duplicações persistirem após o último build WASM, investigar **byte drift no parser de protocolo** (patches sed no workflow de build).
