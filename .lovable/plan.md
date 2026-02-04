

# Plano: Criar Página de Runas com Modal de Detalhes

## Resumo

Vou criar uma nova página de Runas (`/runes`) com tabela contendo todas as 27 runas do jogo, ordenação por todas as colunas, e um modal de detalhes ao clicar que mostra tempo para fazer uma backpack e quantidade de comida necessária por vocação.

---

## Dados Extraídos do Site

### Tabela Principal (27 runas)

| Mlvl Cast | Nome | Vocações | Premium | Mana | Charges | Mlvl Use |
|-----------|------|----------|---------|------|---------|----------|
| 1 | Light Magic Missile | D, S, P | ❌ | 40 | 5 | 0 |
| 2 | Poison Field | D, S | ❌ | 50 | 3 | 0 |
| 3 | Heavy magic missile | D, S, P | ❌ | 70 | 5 | 1 |
| 3 | Fire Field | D, S | ❌ | 60 | 3 | 1 |
| 4 | Antidote Rune | D | ❌ | 50 | 1 | 0 |
| 4 | Intense Healing Rune | D | ❌ | 60 | 1 | 1 |
| 5 | Fireball | D, S, P | ❌ | 60 | 3 | 2 |
| 5 | Energy Field | D, S | ❌ | 80 | 3 | 3 |
| 6 | Destroy Field | D, S, P | ❌ | 60 | 3 | 3 |
| 7 | Animate Dead | D, S | ✅ | 300 | 2 | 4 |
| 7 | Envenom | D | ✅ | 100 | 3 | 4 |
| 8 | Desintegrate | D, S, P | ✅ | 100 | 3 | 4 |
| 8 | Poisonbomb | D | ✅ | 130 | 2 | 4 |
| 9 | Great Fireball | D, S | ❌ | 120 | 2 | 4 |
| 9 | Firebomb | D, S | ❌ | 150 | 2 | 5 |
| 10 | Convince Creature | D | ❌ | 100 | 1 | 5 |
| 11 | Poison Wall | D, S | ❌ | 160 | 4 | 5 |
| 11 | Chameleon | D | ❌ | 150 | 1 | 4 |
| 11 | Ultimate Healing Rune | D | ❌ | 100 | 1 | 4 |
| 12 | Explosion | D, S | ❌ | 180 | 3 | 6 |
| 13 | Soulfire | D, S | ✅ | 150 | 2 | 7 |
| 13 | Fire Wall | D, S | ❌ | 200 | 4 | 13 |
| 14 | Magic Wall | S | ✅ | 250 | 4 | 9 |
| 18 | Energy Bomb | S | ✅ | 220 | 2 | 10 |
| 18 | Energy Wall | D, S | ❌ | 250 | 4 | 9 |
| 25 | Sudden Death | S | ❌ | 220 | 1 | 15 |
| 35 | Paralyze | D | ✅ | 600 | 1 | 18 |

### Modal de Detalhes (exemplo SD)

Ao clicar na runa, mostra informações de produção por vocação:

**Sorcerer:**
- Tempo: 7h 20min 0sec
- Comidas necessárias: Dragon Ham x37, Ham x74, Brown Mushroom x100, Meat x147, Fish x184, White Mushroom x245, Roast Pork x275

**Master Sorcerer:**
- Tempo: 4h 53min 20sec
- Comidas necessárias: Dragon Ham x25, Ham x49, Brown Mushroom x67, Meat x98, Fish x123, White Mushroom x163, Roast Pork x184

---

## Arquivos a Criar/Modificar

### 1. Criar Arquivo de Dados das Runas
**Arquivo**: `src/data/runes.ts`

```typescript
export interface Rune {
  id: string;
  name: string;
  image: string;
  spell: string;
  mlvlCast: number;
  mlvlUse: number;
  mana: number;
  charges: number;
  vocations: string[];
  isPremium: boolean;
}

// Array com as 27 runas
export const runes: Rune[] = [
  {
    id: 'lmm',
    name: 'Light Magic Missile',
    image: 'https://tibiara.netlify.app/en/img/runes/lmm.gif',
    spell: 'adori',
    mlvlCast: 1,
    mlvlUse: 0,
    mana: 40,
    charges: 5,
    vocations: ['Druid', 'Sorcerer', 'Paladin'],
    isPremium: false,
  },
  // ... mais 26 runas
];
```

### 2. Criar Página de Runas
**Arquivo**: `src/pages/RunesPage.tsx`

- Tabela com colunas: Mlvl Cast, Imagem, Nome, Vocação, Premium, Mana, Cargas, Mlvl Use
- Ordenação clicável em todas as colunas numéricas
- Busca por nome
- Linha clicável abre modal de detalhes

### 3. Criar Tabela de Runas
**Arquivo**: `src/components/RunesTable.tsx`

- Componente de tabela específico para runas
- Estado de ordenação (sortKey, sortDirection)
- Estado do modal (selectedRune, modalOpen)
- Exibe vocações formatadas com quebra de linha

### 4. Criar Modal de Detalhes da Runa
**Arquivo**: `src/components/RuneDetailsModal.tsx`

- Modal com informações da runa selecionada
- Carrega dados via Edge Function (scraping da página de detalhes)
- Exibe por vocação: tempo para fazer backpack + comidas necessárias

### 5. Criar Edge Function para Scraping
**Arquivo**: `supabase/functions/scrape-rune-details/index.ts`

- Recebe o ID da runa (ex: 'sd', 'uh')
- Faz scraping de `https://tibiara.netlify.app/en/pages/items/{id}`
- Extrai: nome, spell, mana, informações por vocação (tempo + comidas)
- Retorna JSON estruturado

### 6. Criar Hook para Detalhes da Runa
**Arquivo**: `src/hooks/useRuneDetails.ts`

```typescript
export function useRuneDetails(runeId: string | null) {
  return useQuery({
    queryKey: ['runeDetails', runeId],
    queryFn: () => fetchRuneDetails(runeId!),
    enabled: !!runeId,
    staleTime: 5 * 60 * 1000, // 5 min cache
  });
}
```

### 7. Adicionar Rota no App
**Arquivo**: `src/App.tsx`

```typescript
import RunesPage from './pages/RunesPage';
// ...
<Route path="/runes" element={<RunesPage />} />
```

### 8. Adicionar Traduções
**Arquivos**: `src/i18n/translations/*.ts`

```typescript
// Adicionar em cada idioma:
runes: {
  title: 'Runes',
  description: 'All runes available in the game with...',
  mlvlCast: 'Mlvl Cast',
  mlvlUse: 'Mlvl Use',
  mana: 'Mana',
  charges: 'Charges',
  vocations: 'Vocations',
  premium: 'Premium',
  timeToMake: 'Time to make backpack',
  foodNeeded: 'Food needed',
}
```

### 9. Adicionar Link no Menu/Sidebar
**Arquivo**: `src/components/Sidebar.tsx`

Adicionar link para `/runes` na seção "Others" ou criar nova categoria.

---

## Estrutura do Modal de Detalhes

```text
┌──────────────────────────────────────────────────────┐
│  🎯 Sudden Death                                 [X] │
├──────────────────────────────────────────────────────┤
│  Spell: Adori vita vis                               │
│  Mana: 220                                           │
├──────────────────────────────────────────────────────┤
│  📦 Backpack de Runas - Sorcerer                     │
│  ┌──────────────────────────────────────────────────┐│
│  │ ⏱️ Tempo: 7h 20min 0sec                          ││
│  │                                                  ││
│  │ 🍗 Comidas necessárias:                          ││
│  │ 🥩 Dragon Ham x37  |  🍖 Ham x74                 ││
│  │ 🍄 Brown Mushroom x100  |  🍖 Meat x147          ││
│  │ 🐟 Fish x184  |  🍄 White Mushroom x245          ││
│  │ 🍖 Roast Pork x275                               ││
│  └──────────────────────────────────────────────────┘│
├──────────────────────────────────────────────────────┤
│  📦 Backpack de Runas - Master Sorcerer              │
│  ┌──────────────────────────────────────────────────┐│
│  │ ⏱️ Tempo: 4h 53min 20sec                         ││
│  │                                                  ││
│  │ 🍗 Comidas necessárias:                          ││
│  │ 🥩 Dragon Ham x25  |  🍖 Ham x49  |  ...         ││
│  └──────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

---

## Resumo da Implementação

| Item | Quantidade |
|------|------------|
| Arquivos novos | 6 (RunesPage, RunesTable, RuneDetailsModal, runes.ts, useRuneDetails, edge function) |
| Arquivos modificados | 5 (App.tsx, Sidebar.tsx, 4 traduções) |
| Runas cadastradas | 27 |
| Edge Function | 1 nova (scrape-rune-details) |
| Idiomas | 4 (PT, EN, ES, PL) |

---

## Detalhes Técnicos

### Edge Function - Parsing do HTML

A página de detalhes tem estrutura:
1. Tabela `#oneitems` - info básica (nome, imagem, spell, mana)
2. Múltiplas tabelas `#monster` - uma por vocação com tempo
3. Tabelas `#runes` - comidas necessárias após cada `#monster`

O scraper precisa:
1. Extrair nome, spell, mana da tabela inicial
2. Iterar pelas tabelas `#monster` e `#runes` alternadamente
3. Associar cada vocação com suas comidas

### Imagens das Comidas no Modal

Mapeamento de IDs para nomes:
- `dragon_meat.gif` → Dragon Ham
- `199.gif` → Ham
- `620.gif` → Brown Mushroom
- `200.gif` → Meat
- `194.gif` → Fish
- `344.gif` → White Mushroom
- `203.gif` → Roast Pork

