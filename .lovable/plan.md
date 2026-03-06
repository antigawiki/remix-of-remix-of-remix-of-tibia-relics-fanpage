

## Diagnóstico: 2 Problemas Identificados

### Problema 1: Top Gainers parado em 18/02 → 19/02

**Causa**: A edge function `save-highscores` **não tem cron job configurado**. Existe cron para `track-online-players`, `scrape-character-accounts`, `analyze-alt-matches` e `snapshot-xp`, mas NÃO para `save-highscores`. Os snapshots pararam em 19/02 porque foi a última vez que alguém rodou manualmente. Acabei de executá-la manualmente e o snapshot de hoje (06/03) foi salvo com sucesso.

**Correção**: Criar um cron job via migration SQL para rodar `save-highscores` 1x por dia (ex: às 00:05 UTC).

```sql
SELECT cron.schedule(
  'save-highscores-daily',
  '5 0 * * *',
  $$SELECT net.http_post(
    url:='https://rmofmkjmzwkxjzfirbpt.supabase.co/functions/v1/save-highscores',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer ..."}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;$$
);
```

---

### Problema 2: Alt Detector crasha com "CPU Time exceeded"

**Causa**: O algoritmo O(n²) compara 1009 players × 17889 sessões, gerando ~500.000 comparações de pares, cada uma iterando sessões cruzadas. Isso excede o limite de CPU das edge functions (~2s wall time).

**Correção**: Otimizar `analyze-alt-matches/index.ts`:
1. **Pré-ordenar sessões** por timestamp para cada jogador
2. **Usar busca binária** em vez de loop bruto para encontrar adjacências (de O(n×m) para O(n×log(m)))
3. **Skip rápido**: se `sessA[last].logout < sessB[first].login - 5min` e vice-versa, pular o par inteiro
4. **Limitar sessões por jogador** às últimas 50 (sessões muito antigas são menos relevantes)
5. **Adicionar timeout check**: se já passou 80% do tempo disponível, parar e salvar resultados parciais

Essas otimizações devem reduzir o tempo de execução de >2s para <500ms.

---

### Problema 3 (bonus): Preview não carrega

Forçar rebuild do Vite com edição trivial no `src/App.tsx` para reinjetar variáveis de ambiente.

