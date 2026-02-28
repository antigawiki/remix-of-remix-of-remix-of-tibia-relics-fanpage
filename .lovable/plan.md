

## Plano: Filtrar Players das Criaturas no Cam Map

### Situacao Atual
O mapa base externo (opentibia) ja fornece o terreno e esta funcionando corretamente. O problema e que as criaturas extraidas incluem **players** (jogadores) alem dos monstros, o que polui o mapa com entidades que nao sao relevantes para identificar spawns de hunts.

### Solucao

Filtrar players durante a extracao no `mapExtractor.ts`, usando duas regras:

1. **Excluir o jogador da gravacao**: Pular criaturas cujo `id === gs.playerId`
2. **Excluir outros jogadores**: Players no Tibia 7.x possuem cores de outfit customizaveis (head, body, legs, feet com valores > 0). Monstros e NPCs tipicamente tem esses valores zerados. Usar isso como heuristica para filtrar players.

### Detalhes Tecnicos

**Arquivo: `src/lib/tibiaRelic/mapExtractor.ts`**

Na funcao `snapshotCreatures`, adicionar filtros:

```text
// Pular o player que gravou a cam
if (c.id === gs.playerId) continue;

// Pular outros players (possuem cores de outfit customizadas)
if (c.head !== 0 || c.body !== 0 || c.legs !== 0 || c.feet !== 0) continue;
```

A funcao precisa receber o `GameState` completo (ja recebe) para acessar `gs.playerId` e as propriedades `head/body/legs/feet` de cada criatura.

### O que NAO muda
- O mapa base externo (terreno) continua carregando normalmente
- Os tiles extraidos das .cam continuam sem ser renderizados (terreno vem do mapa externo)
- A logica de deduplicacao por grid 5x5 permanece

### Resultado
O mapa mostrara apenas o terreno do opentibia + sprites de monstros vivos nos locais corretos, sem players.

**Obs**: Sera necessario re-extrair os arquivos .cam no Batch Extract para que os dados no banco sejam atualizados sem players.

