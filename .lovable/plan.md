

## Plano: Ordenação padrão e controles de ordenação em todas as tabelas

### Estado atual

| Página | Tem ordenação? | Ordenação padrão |
|--------|---------------|-----------------|
| EquipmentTable | Sim | `name` asc (errado) |
| DeathRowPage | **Nao** | nenhuma |
| HighscoresPage | **Nao** | dados da API |
| OnlinePlayersPage | **Nao** | nenhuma |
| LatestDeathsPage | **Nao** | nenhuma |
| TopGainersPage | **Nao** | nenhuma |
| CreaturesTable | Sim | `name` asc (ok) |
| SpellsTable | Sim | `mlvl` asc (ok) |
| ItemsTable | Sim | `name` asc (ok) |
| RunesTable | Sim | `mlvlCast` asc (ok) |
| KillStatisticsPage | Sim | `overallKilledByPlayers` desc (ok) |

### Mudancas

**1. `EquipmentTable.tsx`** — Mudar ordenacao padrao baseada na categoria:
- `shields` → `defense` desc
- Categorias com `attack` (swords, axes, clubs, distance, ammo) → `attack` desc
- Categorias com `armor` (helmets, armors, legs, boots) → `armor` desc

**2. `DeathRowPage.tsx`** — Adicionar estado de sort e headers clicaveis para date, character, level, reason. Default: sem mudanca (ordem da API = mais recente primeiro).

**3. `OnlinePlayersPage.tsx`** — Adicionar sort por name, vocation, level. Default: `level` desc.

**4. `LatestDeathsPage.tsx`** — Adicionar sort por date, character, level. Default: ordem da API.

**5. `HighscoresPage.tsx`** — Adicionar sort por name, vocation, level, score. Default: rank da API (score desc).

**6. `TopGainersPage.tsx`** — Adicionar sort por name, level, xpGained. Default: rank da API.

### Abordagem tecnica

Cada pagina segue o mesmo padrao ja usado em KillStatisticsPage/CreaturesTable:
- Estado `sortKey` + `sortDirection`
- Header com `ArrowUpDown` icon e `cursor-pointer`
- `useMemo` ou sort inline no render
- Sem dependencias novas

