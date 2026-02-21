

# 3 Melhorias: Ultimas Mortes, Kill Statistics e Menu Mobile

## 1. Pagina Ultimas Mortes - Mostrar total real

**Problema:** A pagina mostra "200 mortes" mas existem 356 no banco. Da a entender que so existem 200.

**Solucao:**
- Buscar o total real do banco com uma query `COUNT(*)` separada ou simplesmente aumentar o limit para buscar todas
- Adicionar texto informativo como "Mostrando as 200 mais recentes de 356 mortes registradas"
- Ou melhor: mostrar todas com paginacao (carregar mais)

**Arquivo:** `src/hooks/useLatestDeaths.ts` e `src/pages/LatestDeathsPage.tsx`
- Aumentar limit padrao ou adicionar botao "Carregar mais"
- Exibir contagem total no topo

---

## 2. Nova pagina: Kill Statistics (Monstros Mortos)

**API:** `https://api.tibiarelic.com/api/KillStatistics?worldName=Relic`

Esta API retorna estatisticas de mortes de monstros (quantos mataram jogadores e quantos foram mortos por jogadores) nos periodos: ultimo dia, ultima semana e overall.

### Mudancas:

**a) Proxy - adicionar endpoint `kill-statistics`**
- Arquivo: `supabase/functions/tibia-relic-proxy/index.ts`
- Novo case no switch para `kill-statistics` apontando para `${API_BASE}/KillStatistics?worldName=Relic`

**b) Hook para buscar dados**
- Novo arquivo: `src/hooks/useKillStatistics.ts`
- Chama o proxy, retorna a lista de criaturas com estatisticas

**c) Nova pagina: `src/pages/KillStatisticsPage.tsx`**
- Rota: `/kill-statistics`
- Layout similar a referencia (tabela com colunas Last Day / Last Week / Overall)
- Cada linha mostra a imagem da criatura ao lado do nome (mapeando pelo nome com os dados de `src/data/creatures.ts`)
- Colunas: Race (com imagem), Killed Players (dia/semana/total), Killed by Players (dia/semana/total)
- Busca por nome de criatura
- Ordenacao por coluna

**d) Rota no App.tsx**
- Adicionar `<Route path="/kill-statistics" element={<KillStatisticsPage />} />`

**e) Navegacao**
- Sidebar: adicionar link "Monstros Mortos" / "Kill Statistics"
- Mobile menu (Header.tsx): adicionar link tambem

**f) Traducoes (i18n)**
- Adicionar chaves em `types.ts` e nos 4 arquivos de traducao (pt/en/es/pl)
- Chaves: `navigation.killStatistics`, `pages.killStatistics.title`, `pages.killStatistics.description`, colunas da tabela

---

## 3. Menu Mobile - Links faltando

**Problema:** O menu mobile no Header.tsx nao inclui varios links que existem no Sidebar desktop:
- "Ultimas Mortes" (latest-deaths)
- "Hunt Admin" (hunt-admin)
- "Top Gainers" ja esta, mas falta "Ultimas Mortes"
- A nova pagina "Kill Statistics" tambem precisa estar

**Solucao:**
- Arquivo: `src/components/Header.tsx`
- Adicionar no menu mobile:
  - Link para `/latest-deaths` com icone Skull
  - Link para `/kill-statistics` com icone (ex: BarChart3 ou Target)
  - Link para `/hunt-admin` com icone Swords
- Organizar os links na mesma ordem do Sidebar

---

## Detalhes Tecnicos

### Mapeamento criatura -> imagem

O arquivo `src/data/creatures.ts` contem todas as criaturas com seus nomes e URLs de imagem. Para a pagina de Kill Statistics, faremos um Map por nome (case-insensitive) para associar a imagem da API ao sprite local. Criaturas sem match mostram um placeholder.

### Estrutura esperada da API KillStatistics

Baseado na referencia visual, cada entrada da API deve conter:
- `race` (nome da criatura)
- `lastDayKilledPlayers`, `lastDayKilledByPlayers`
- `lastWeekKilledPlayers`, `lastWeekKilledByPlayers`
- `killedPlayers`, `killedByPlayers` (overall)

### Arquivos criados
- `src/hooks/useKillStatistics.ts`
- `src/pages/KillStatisticsPage.tsx`

### Arquivos modificados
- `supabase/functions/tibia-relic-proxy/index.ts` (novo endpoint)
- `src/App.tsx` (nova rota)
- `src/components/Sidebar.tsx` (novo link)
- `src/components/Header.tsx` (links mobile faltando)
- `src/i18n/types.ts` (novas chaves)
- `src/i18n/translations/pt.ts`, `en.ts`, `es.ts`, `pl.ts` (traducoes)
- `src/pages/LatestDeathsPage.tsx` (mostrar total real)
- `src/hooks/useLatestDeaths.ts` (buscar total)
