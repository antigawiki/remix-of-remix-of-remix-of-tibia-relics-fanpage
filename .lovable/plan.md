
# Melhorias no Alt Detector

## O que será feito

### 1. UI: Remover "Pares Confirmados", manter só "Alts por Conta" e "Suspeitos"

A aba "Pares Confirmados" é redundante com "Alts por Conta" — ela mostra os mesmos dados em formato de pares. Será removida.

Remover também os botões "Raspar Perfis" e "Rodar Análise" da interface (os crons já fazem isso automaticamente a cada 15min e 10min).

### 2. UI: Redesign da aba "Alts por Conta"

Cada grupo de conta vai ter um visual hierárquico:

```text
┌─────────────────────────────────────────────────────┐
│  [★ MAIN] Don Flame  Lv.65  Master Sorcerer         │
│  ─────────────────────────────────────────────────  │
│  [alt] Aelene    [alt] Bitter Kee    [alt] Zen ...  │
└─────────────────────────────────────────────────────┘
```

- O char de **maior level** (consultado via `xp_snapshots` ou `highscore_snapshots`) fica em destaque com badge "MAIN" no topo
- Os demais ficam abaixo como chips menores
- Se não houver dado de level no banco, exibe todos igualmente

Para buscar o level: cruzar os nomes do `account_chars` com os dados de `xp_snapshots` (que já temos) ou `highscore_snapshots`. O char com maior level fica no topo.

### 3. UI: Aba "Suspeitos" — melhorar apresentação

Mostrar claramente:
- Nome dos dois chars suspeitos
- Probabilidade com badge colorido por faixa (>60% = vermelho, 35-60% = amarelo, <35% = cinza)
- Número de coincidências de login/logout adjacentes
- Sessões de cada um

### 4. Backend: Corrigir sessões abertas sem logout

Há 86 sessões com `logout_at IS NULL` no banco. Isso acontece quando o cron reinicia e perde o estado de quem estava online. 

Corrigir na edge function `track-online-players`: ao iniciar, comparar o `online_tracker_state` com quem está realmente online agora, e fechar automaticamente as sessões que ficaram abertas de uma invocação anterior.

### 5. Backend: Tracker já cobre 24h/5 segundos — confirmar e documentar

O sistema **já funciona** 24h por dia a cada ~5 segundos:
- Cron dispara a edge function a cada **1 minuto** (`* * * * *`)
- Dentro de cada invocação, a função faz polls de **5 em 5 segundos** por 55 segundos
- Ao reiniciar, continua do estado salvo no banco

Não há mudança necessária aqui — apenas garantir que sessões abertas sejam corrigidas no restart (item 4).

### 6. Backend: Atualizar `track-online-players` para usar API `character/by-name`

A função ainda usa HTML scraping (código legado). Substituir por:

```typescript
const apiUrl = `https://api.tibiarelic.com/api/Community/character/by-name?name=${encodeURIComponent(name)}`;
```

Removendo as funções `extractCharsFromNextData`, `extractCharsFromHtml` e a variável `CHARACTER_URL`.

## Arquivos a Modificar

1. **`src/pages/AltDetectorPage.tsx`** — Remover aba "Pares Confirmados", remover botões "Raspar Perfis" e "Rodar Análise", redesenhar cards de "Alts por Conta" com main char destacado, buscar levels de `xp_snapshots`

2. **`supabase/functions/track-online-players/index.ts`** — Remover código HTML scraping legado, usar API `character/by-name`, corrigir sessões abertas no restart

## Resultado Esperado

- Interface limpa com 2 abas: "Alts por Conta" (visual hierárquico) e "Suspeitos"
- Char de maior level destacado como "MAIN" em cada grupo de conta
- Sessões de login/logout mais precisas (sem sessões eternamente abertas)
- Dados estatísticos mais precisos à medida que o banco acumula sessões corretamente fechadas
