
# Corrigir o Alt Detector: Usar a API Correta do Tibiarelic

## Diagnóstico

O sistema está completamente travado porque:

1. A edge function `scrape-character-accounts` tenta `GET /api/Community/Character/{name}` (404) e depois scraping HTML (bloqueado por 429 no servidor)
2. O resultado: 363 chars no banco, todos com erro, **0 alts confirmados**
3. A API correta descoberta agora é: `GET /api/Community/character/by-name?name={name}` que retorna JSON com o array `characters[]` completo da conta — funcionando em tempo real

## O que a API retorna (confirmado)

```text
GET https://api.tibiarelic.com/api/Community/character/by-name?name=Josuba

{
  "name": "Josuba",
  "level": 33,
  "profession": "Royal Paladin",
  "online": true/false,
  "characters": [
    { "name": "Josuba",    "level": 33, "worldName": "Relic", "online": true },
    { "name": "Josubah",   "level": 8,  "worldName": "Relic", "online": false },
    { "name": "Josubao",   "level": 8,  "worldName": "Relic", "online": false },
    { "name": "Josubest",  "level": 7,  "worldName": "Relic", "online": false },
    { "name": "Josubinha", "level": 1,  "worldName": "Relic", "online": false }
  ]
}
```

- O campo `characters[]` lista **todos os personagens da conta** sem autenticação
- O campo `online` de cada char é atualizado em tempo real
- Sem bloqueio de IP — é uma API JSON pública, não scraping HTML

## Plano de Implementação

### 1. Corrigir `scrape-character-accounts/index.ts`

Substituir o endpoint errado pelo correto:

```typescript
// ANTES (não funciona):
const apiUrl = `https://api.tibiarelic.com/api/Community/Character/${name}`;

// DEPOIS (funciona):
const apiUrl = `https://api.tibiarelic.com/api/Community/character/by-name?name=${encodeURIComponent(name)}`;

// Extrair alts do campo characters[]:
const chars = data.characters?.map(c => c.name) ?? [name];
```

Remover o fallback HTML completamente — não é necessário agora que a API funciona.

Aumentar `MAX_PER_RUN` de 15 para **50** (a API JSON é rápida e não bloqueia) e reduzir o delay de 500ms para **200ms**.

### 2. Corrigir `AltDetectorPage.tsx` — scraping via browser

A função `scrapeCharacterFromBrowser` também precisa usar a API correta em vez de raspar HTML. Como não há bloqueio de CORS na API, o browser pode chamar diretamente:

```typescript
// ANTES: fetch('https://www.tibiarelic.com/characters/{name}') → HTML
// DEPOIS: fetch('https://api.tibiarelic.com/api/Community/character/by-name?name={name}') → JSON
```

Isso elimina toda a lógica de `extractCharsFromNextData` e `extractCharsFromHtml` — que podem ser removidas.

### 3. Adicionar suporte ao `tibia-relic-proxy` para o novo endpoint

Adicionar o case `character-by-name` no proxy para ser usado pelo frontend de forma segura (sem expor a URL da API diretamente no código cliente):

```typescript
case "character-by-name": {
  const name = url.searchParams.get("name");
  apiUrl = `${API_BASE}/Community/character/by-name?name=${encodeURIComponent(name)}`;
  break;
}
```

### 4. Resetar os registros com erro no banco

Após corrigir o código, os 363 registros que têm `scrape_error` precisam ser resetados para que o cron os processe novamente com a API correta. Isso é feito via SQL no banco:

```sql
UPDATE character_accounts SET scrape_error = NULL, account_chars = '{}' WHERE scrape_error IS NOT NULL;
```

## Arquivos a Modificar

1. **`supabase/functions/scrape-character-accounts/index.ts`** — Usar URL correta, remover HTML scraping, aumentar batch size para 50, delay para 200ms
2. **`src/pages/AltDetectorPage.tsx`** — `scrapeCharacterFromBrowser` usa API JSON ao invés de HTML, remover funções de parsing HTML que não são mais necessárias
3. **`supabase/functions/tibia-relic-proxy/index.ts`** — Adicionar endpoint `character-by-name`
4. **SQL (via ferramenta de dados)** — Resetar os 363 registros com erro para serem reprocessados

## Resultado Esperado

- O cron a cada 15 min processa 50 chars por vez (antes processava 15 e todos falhavam)
- Em ~2 horas, todos os 363 chars terão seus alts confirmados via API
- O botão "Raspar Perfis" na página também usará a API JSON, eliminando completamente os erros de 429/Failed to fetch
- A aba "Por Conta" começará a mostrar grupos de alts confirmados
