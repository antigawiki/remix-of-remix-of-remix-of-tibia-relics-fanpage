
# Plano: Adicionar Criatura Giant e Melhorar Menu Mobile

## Problemas Identificados

### 1. Adicionar Criatura "Giant"
- **Nome**: Giant
- **Exp**: 900
- **HP**: 1300
- **Summon**: null (não tem)
- **Convince**: null (não tem)
- **Imagem**: Será copiada do arquivo enviado para `/public/creatures/giant.gif`

### 2. Menu de Navegação no Mobile
Atualmente, as sidebars são completamente escondidas no mobile (`hidden lg:block`). O menu hamburguer no Header existe, mas está faltando vários links importantes:

**Links presentes no Header mobile:**
- Home, Equipment, Spells, Creatures, Quests, Calculators, Info
- Site Oficial, Banned, Map

**Links que faltam (existem apenas na Sidebar):**
- Items
- Runas
- Ranking/Highscores
- Top Gainers
- Online Players

---

## Alterações Necessárias

### Arquivo 1: Copiar Imagem da Criatura
**Ação**: Copiar `user-uploads://253.png` → `public/creatures/giant.png`

### Arquivo 2: `src/data/creatures.ts`
**Ação**: Adicionar a criatura Giant na lista (em ordem alfabética, entre "Ghoul" e "Giant Spider")

```typescript
{
  name: "Giant",
  image: "/creatures/giant.png",
  exp: 900,
  hp: 1300,
  summon: null,
  convince: null,
},
```

### Arquivo 3: `src/components/Header.tsx`
**Ação**: Adicionar os links que faltam no menu mobile

```typescript
// Adicionar após "Creatures" e antes de "Quests":
<Link to="/items" ...>
  <Package className="w-4 h-4" />
  {t('navigation.items')}
</Link>
<Link to="/runes" ...>
  <Sparkles className="w-4 h-4" />
  {t('pages.runes.title')}
</Link>

// Adicionar após "Info", separador, e antes do "Site Oficial":
<Link to="/highscores" ...>
  <Trophy className="w-4 h-4" />
  {t('navigation.ranking')}
</Link>
<Link to="/top-gainers" ...>
  <TrendingUp className="w-4 h-4" />
  {t('navigation.topGainers')}
</Link>
<Link to="/online" ...>
  <Users className="w-4 h-4" />
  {t('navigation.online')}
</Link>
```

---

## Resumo das Alterações

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `public/creatures/giant.png` | Copiar | Imagem da criatura Giant |
| `src/data/creatures.ts` | Modificar | Adicionar Giant à lista de criaturas |
| `src/components/Header.tsx` | Modificar | Adicionar links faltando no menu mobile |

---

## Menu Mobile Atualizado

Após as alterações, o menu hamburguer terá:

```text
┌──────────────────────────────┐
│ [Home]                       │
│ [Equipment]                  │
│ [Items] ← NOVO               │
│ [Spells]                     │
│ [Creatures]                  │
│ [Runes] ← NOVO               │
│ [Quests]                     │
│ [Calculators]                │
│ [Info]                       │
├──────────────────────────────┤
│ [Ranking] ← NOVO             │
│ [Top Gainers] ← NOVO         │
│ [Online] ← NOVO              │
├──────────────────────────────┤
│ [Site Oficial]               │
│ [Banned]                     │
│ [Mapa]                       │
└──────────────────────────────┘
```
