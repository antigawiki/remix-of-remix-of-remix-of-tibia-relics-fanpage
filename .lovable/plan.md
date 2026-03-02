

## Enquetes: Traducao + Pagina Dedicada + Prazo de Encerramento

### Resumo

Adicionar suporte completo de traducao ao sistema de enquetes, criar uma pagina dedicada `/polls` com historico de todas as enquetes, adicionar campo `ends_at` para prazo de encerramento, e ajustar a logica para mostrar resultados quando a enquete expirou ou o usuario ja votou.

### 1. Banco de Dados

**Alterar tabela `polls`** - adicionar coluna de prazo:

```sql
ALTER TABLE polls ADD COLUMN ends_at timestamptz;
```

Enquetes sem `ends_at` ficam abertas indefinidamente (retrocompativel). A logica de "enquete ativa" passa a considerar `active = true AND (ends_at IS NULL OR ends_at > now())`.

### 2. Traducoes (i18n)

Adicionar secao `poll` no sistema de traducao (types.ts + 4 arquivos de idioma):

| Chave | PT | EN | ES | PL |
|---|---|---|---|---|
| poll.sectionTitle | Enquete | Poll | Encuesta | Ankieta |
| poll.vote | Votar | Vote | Votar | Glosuj |
| poll.voting | Votando... | Voting... | Votando... | Glosowanie... |
| poll.votes | votos | votes | votos | glosow |
| poll.vote_singular | voto | vote | voto | glos |
| poll.total | Total | Total | Total | Razem |
| poll.ended | Encerrada | Ended | Finalizada | Zakonczona |
| poll.endsAt | Encerra em | Ends in | Finaliza en | Konczy sie za |
| poll.allPolls | Todas as Enquetes | All Polls | Todas las Encuestas | Wszystkie Ankiety |
| poll.noPolls | Nenhuma enquete disponivel | No polls available | Sin encuestas | Brak ankiet |
| poll.pageTitle | Enquetes | Polls | Encuestas | Ankiety |
| poll.pageDescription | Historico de enquetes... | Poll history... | Historial... | Historia ankiet... |
| poll.active | Ativa | Active | Activa | Aktywna |
| poll.closed | Encerrada | Closed | Cerrada | Zamknieta |
| poll.viewAll | Ver todas | View all | Ver todas | Zobacz wszystkie |

As opcoes da enquete no banco continuam em portugues (sao conteudo, nao UI). Se futuramente quiser opcoes multi-idioma, as `options` do JSONB podem ter `label_pt`, `label_en`, etc.

### 3. Componente PollBox.tsx (Refatorar)

- Substituir todas as strings hardcoded por chamadas `t('poll.xxx')`
- Adicionar logica de prazo: se `poll.ends_at` existe e ja passou, mostrar resultados automaticamente (sem opcao de votar)
- Mostrar badge "Encerrada" ou countdown "Encerra em X dias"
- Adicionar link "Ver todas" apontando para `/polls`

### 4. Hook usePoll.ts (Refatorar)

- Adicionar `ends_at` a interface `Poll`
- Alterar query: buscar a enquete mais recente (nao necessariamente ativa -- a ultima criada)
- Calcular `isExpired` baseado em `ends_at`
- Se `isExpired` ou `hasVoted`, mostrar resultados
- Criar novo hook `usePolls()` para a pagina de listagem (busca todas as enquetes ordenadas por data)

### 5. Pagina /polls (Nova)

- Listagem de todas as enquetes, da mais recente para a mais antiga
- Cada enquete mostra: titulo, status (Ativa/Encerrada), data de criacao, prazo
- Se ativa e nao votou: permite votar inline
- Se encerrada ou ja votou: mostra resultados com barras de progresso
- Estilo consistente com o restante do site (wood-panel, maroon-header)

### 6. Navegacao

- Adicionar link "Enquetes" no Sidebar esquerdo (entre Quests e Calculators)
- Adicionar rota `/polls` no App.tsx

### 7. Edge Function cast-vote

- Adicionar verificacao de `ends_at`: rejeitar votos em enquetes expiradas
- Verificar `active = true` antes de aceitar o voto

### 8. Atualizar enquete existente

- Definir `ends_at` da primeira enquete para daqui a 7 dias (via insert tool, nao migration)

### Resumo de Arquivos

| Arquivo | Acao |
|---|---|
| Migration SQL | EDITAR tabela polls (add ends_at) |
| `src/i18n/types.ts` | EDITAR - adicionar secao poll |
| `src/i18n/translations/pt.ts` | EDITAR - adicionar traducoes poll |
| `src/i18n/translations/en.ts` | EDITAR - adicionar traducoes poll |
| `src/i18n/translations/es.ts` | EDITAR - adicionar traducoes poll |
| `src/i18n/translations/pl.ts` | EDITAR - adicionar traducoes poll |
| `src/hooks/usePoll.ts` | EDITAR - adicionar ends_at, isExpired, usePolls |
| `src/components/PollBox.tsx` | EDITAR - traducao + prazo + link ver todas |
| `src/pages/PollsPage.tsx` | CRIAR - pagina de listagem |
| `src/components/Sidebar.tsx` | EDITAR - adicionar link Enquetes |
| `src/App.tsx` | EDITAR - adicionar rota /polls |
| `supabase/functions/cast-vote/index.ts` | EDITAR - validar ends_at |

