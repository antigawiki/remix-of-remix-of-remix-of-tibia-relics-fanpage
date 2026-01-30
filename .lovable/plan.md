
## Plano: Integrar APIs do Tibia Relic

### Objetivo
Integrar 3 APIs do servidor Tibia Relic para exibir dados reais de:
1. **Server Status** - Players online, recorde, próximo server save
2. **Ranking/Highscores** - Top players por categoria e vocação
3. **Who is Online** - Lista de jogadores online

---

### Estrutura das APIs

**1. Server Stats**
```
GET https://api.tibiarelic.com/api/Community/Relic/stats
```
Resposta:
```json
{
  "playersOnline": 0,
  "recordOnline": 52,
  "recordOnlineDate": "2026-01-23T19:30:30.533977Z",
  "nextServerSave": "2026-01-31T09:00:00Z"
}
```

**2. Highscores**
```
GET https://api.tibiarelic.com/api/Highscores?worldName=Relic&category=Experience&vocation=All
```
Categorias: Experience, MagicLevel, FistFighting, ClubFighting, SwordFighting, AxeFighting, DistanceFighting, Shielding, Fishing

Vocações: All, None, Knights, Paladins, Sorcerers, Druids

Resposta:
```json
{
  "highscores": [
    {
      "name": "Weedhahaha",
      "profession": "Knight",
      "worldName": "Relic",
      "level": 30,
      "skillLevel": 405042
    },
    ...
  ],
  "lastUpdatedUtc": "2026-01-30T08:47:55Z"
}
```

**3. Who is Online**
```
GET https://api.tibiarelic.com/api/Community/Relic/who-is-online
```
Resposta: Array de players online (estrutura similar ao highscores)

---

### Arquivos a criar

| Arquivo | Descrição |
|---------|-----------|
| `src/hooks/useServerStats.ts` | Hook para buscar status do servidor |
| `src/hooks/useHighscores.ts` | Hook para buscar ranking |
| `src/hooks/useOnlinePlayers.ts` | Hook para buscar players online |
| `src/pages/HighscoresPage.tsx` | Página de ranking completo |
| `src/pages/OnlinePlayersPage.tsx` | Página de quem está online |

---

### Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/Sidebar.tsx` | Integrar dados reais no Server Status e Top 5 |
| `src/App.tsx` | Adicionar rotas para novas páginas |

---

### 1. Criar Hook: `src/hooks/useServerStats.ts`

```typescript
interface ServerStats {
  playersOnline: number;
  recordOnline: number;
  recordOnlineDate: string;
  nextServerSave: string;
}
```

- Usa `@tanstack/react-query` para cache e refetch automático
- Refetch a cada 60 segundos para manter dados atualizados
- Tratamento de erro com fallback para dados vazios

---

### 2. Criar Hook: `src/hooks/useHighscores.ts`

```typescript
interface HighscoreEntry {
  name: string;
  profession: string;
  worldName: string;
  level: number;
  skillLevel: number;
}

interface HighscoresResponse {
  highscores: HighscoreEntry[];
  lastUpdatedUtc: string;
}

type Category = 'Experience' | 'MagicLevel' | 'FistFighting' | 'ClubFighting' | 
                'SwordFighting' | 'AxeFighting' | 'DistanceFighting' | 'Shielding' | 'Fishing';

type Vocation = 'All' | 'None' | 'Knights' | 'Paladins' | 'Sorcerers' | 'Druids';
```

- Aceita parâmetros `category` e `vocation`
- Cache de 5 minutos (dados não mudam frequentemente)
- Função auxiliar `useTopPlayers(limit: number)` para pegar Top 5

---

### 3. Criar Hook: `src/hooks/useOnlinePlayers.ts`

```typescript
interface OnlinePlayer {
  name: string;
  profession: string;
  level: number;
}
```

- Refetch a cada 30 segundos
- Retorna array vazio se ninguém online

---

### 4. Atualizar Sidebar (Right)

**Server Status:**
- Players Online: Dado real da API
- Record: Mostrar recorde com data
- Next SS: Tempo até próximo server save (countdown)
- Status: Verde se API responde, vermelho se erro

**Top 5 Players:**
- Dados reais do ranking de Experience
- Nome do player clicável (link futuro)
- Level real
- Cor dourada #1, prata #2, bronze #3
- Link "Ver ranking completo" aponta para `/highscores`

---

### 5. Criar Página: `src/pages/HighscoresPage.tsx`

**Layout:**
- Usa `MainLayout` com sidebars
- Título: "Ranking" com ícone Trophy

**Filtros:**
- Select de Categoria (Experience padrão)
- Select de Vocação (All padrão)

**Tabela de ranking:**
| # | Nome | Vocação | Level | Pontuação |
|---|------|---------|-------|-----------|
| 1 | Weedhahaha | Knight | 30 | 405,042 |
| ... | ... | ... | ... | ... |

**Informações adicionais:**
- Última atualização: data/hora
- Paginação se necessário (API retorna ~100 players)

---

### 6. Criar Página: `src/pages/OnlinePlayersPage.tsx`

**Layout:**
- Usa `MainLayout` com sidebars
- Título: "Jogadores Online" com ícone Users

**Conteúdo:**
- Contador de players online
- Tabela com jogadores:
  | Nome | Vocação | Level |
  |------|---------|-------|
  | Player1 | Knight | 25 |

- Mensagem especial se ninguém online: "Nenhum jogador online no momento"
- Atualização automática a cada 30 segundos
- Indicador de "Atualizando..." durante refetch

---

### 7. Atualizar Sidebar (Left)

Adicionar links na navegação:
- Ranking (ícone Trophy) -> `/highscores`
- Online (ícone Users) -> `/online`

---

### 8. Atualizar `src/App.tsx`

Adicionar rotas:
```tsx
<Route path="/highscores" element={<HighscoresPage />} />
<Route path="/online" element={<OnlinePlayersPage />} />
```

---

### Detalhes de implementação

**Formatação de números:**
- skillLevel com separador de milhares (405.042)
- Usar `toLocaleString('pt-BR')`

**Formatação de datas:**
- Usar `date-fns` (já instalado)
- `format(new Date(date), "dd/MM/yyyy 'às' HH:mm")`
- Countdown para server save: `formatDistanceToNow`

**Tratamento de vocações (API -> Display):**
| API | Display |
|-----|---------|
| Knight | Knight |
| Elite Knight | Elite Knight |
| Paladin | Paladin |
| Royal Paladin | Royal Paladin |
| Sorcerer | Sorcerer |
| Master Sorcerer | Master Sorcerer |
| Druid | Druid |
| Elder Druid | Elder Druid |
| None | Sem vocação |

---

### Ordem de implementação

1. Criar hooks (useServerStats, useHighscores, useOnlinePlayers)
2. Atualizar Sidebar com dados reais
3. Criar HighscoresPage
4. Criar OnlinePlayersPage
5. Atualizar rotas no App.tsx
6. Adicionar links na navegação

---

### Resumo visual

```text
┌─────────────────────────────────────────────────────────────┐
│                         SIDEBAR (Right)                      │
├─────────────────────────────────────────────────────────────┤
│  ● Server Status                                             │
│    Status: Online                                            │
│    Players: 0 (Recorde: 52)                                  │
│    Next SS: em 2h 30min                                      │
├─────────────────────────────────────────────────────────────┤
│  🏆 Top 5 Players                                            │
│    #1 Weedhahaha      Lvl 30                                 │
│    #2 Mirana Night... Lvl 30                                 │
│    #3 Icsea           Lvl 27                                 │
│    #4 Gnoll           Lvl 26                                 │
│    #5 Destroyer       Lvl 26                                 │
│    Ver ranking completo →                                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     HIGHSCORES PAGE                          │
├─────────────────────────────────────────────────────────────┤
│  🏆 Ranking                                                  │
│                                                              │
│  Categoria: [Experience ▼]  Vocação: [Todas ▼]              │
│                                                              │
│  ┌────┬────────────────┬────────────────┬───────┬──────────┐│
│  │ #  │ Nome           │ Vocação        │ Level │ XP       ││
│  ├────┼────────────────┼────────────────┼───────┼──────────┤│
│  │ 1  │ Weedhahaha     │ Knight         │ 30    │ 405.042  ││
│  │ 2  │ Mirana Night...│ Paladin        │ 30    │ 387.495  ││
│  │ ...│ ...            │ ...            │ ...   │ ...      ││
│  └────┴────────────────┴────────────────┴───────┴──────────┘│
│                                                              │
│  Última atualização: 30/01/2026 às 08:47                    │
└─────────────────────────────────────────────────────────────┘
```
