
# Plano: Internacionalização Completa de Todas as Páginas

## Resumo do Problema

Após análise detalhada do código, confirmei que **muitas páginas e componentes contêm textos fixos em português** e não utilizam o sistema de tradução `useTranslation` que já existe no projeto.

O sistema de i18n já funciona bem em algumas partes (Sidebar, Index, Footer), mas não foi aplicado consistentemente em:
- Páginas de listagem (Spells, Items, Equipment, Creatures)
- Página de ranking e highscores
- Página de jogadores online e banidos
- Página de top gainers
- Todas as 8 calculadoras
- Componentes de tabela (SpellsTable, ItemsTable, etc.)

---

## Arquivos que Precisam de Atualização

### Páginas Principais (9 arquivos)
| Arquivo | Exemplos de textos fixos |
|---------|-------------------------|
| `SpellsPage.tsx` | "Magias", "Consulte as magias...", "magias", "Vocação não encontrada" |
| `ItemsPage.tsx` | "Itens", "Explore todos os itens...", "itens", "Categoria não encontrada" |
| `EquipmentPage.tsx` | "Equipamentos", "Explore todos os equipamentos...", "itens" |
| `CreaturesPage.tsx` | "Criaturas", "Lista completa de todas as criaturas..." |
| `CalculatorsPage.tsx` | "Calculadoras", descrições de cada calculadora |
| `HighscoresPage.tsx` | "Ranking", "Categoria", "Vocação", "Erro ao carregar ranking..." |
| `OnlinePlayersPage.tsx` | "Jogadores Online", "jogador(es) online", "Nenhum jogador online..." |
| `DeathRowPage.tsx` | "Banidos", "Lista de contas permanentemente banidas...", colunas |
| `TopGainersPage.tsx` | "Top Gainers", "Jogadores que mais ganharam experiência...", "XP Ganha" |

### Calculadoras (8 arquivos)
| Calculadora | Textos fixos |
|-------------|-------------|
| `HealDamageCalculator.tsx` | "Calculadora de Heal / Dano", "Level:", "Magic Level:", seções |
| `PhysicalDamageCalculator.tsx` | Título, labels, vocações |
| `DeathExperienceCalculator.tsx` | Título, blessings, resultados |
| `ExperienceLevelCalculator.tsx` | Título, labels, mensagens |
| `MagicLevelCalculator.tsx` | Título, labels, resultados |
| `SkillsCalculator.tsx` | Título, labels, erros |
| `StatsCalculator.tsx` | "Calculadora de Stats", "Escolha sua Vocação:", "Level do Personagem:", "Calcular", "Resultados" |
| `LootCalculator.tsx` | "Calculadora de Loot", "Adicionar Item", "Limpar Tudo", "Total:", "Resumo:" |

### Componentes de Tabela (4 arquivos)
| Componente | Textos fixos |
|------------|-------------|
| `SpellsTable.tsx` | "Buscar magia ou palavras...", colunas (Img, Nome, Palavras, etc.), tipos (Ataque, Cura, Suporte) |
| `ItemsTable.tsx` | "Buscar item...", colunas (img, nome, peso, duração, slots, cidade, proteção, efeito, etc.) |
| `CreaturesTable.tsx` | "Buscar criatura...", colunas (Img, Nome, Exp, HP, Summon, Convince), contador |
| `EquipmentTable.tsx` | "Buscar equipamento...", colunas (Arm, Atk, Def, Peso, Atributos), "Clique em um item para mais detalhes" |

---

## Novas Chaves de Tradução Necessárias

### Seção `pages` (nova)
```text
pages.spells.title                    → "Magias" / "Spells"
pages.spells.description              → "Consulte as magias disponíveis..."
pages.spells.spellCount               → "{count} magias" / "{count} spells"
pages.spells.vocationNotFound         → "Vocação não encontrada" / "Vocation not found"
pages.spells.backTo                   → "Voltar para magias" / "Back to spells"
pages.spells.descriptions.sorcerer    → "Magias ofensivas e de suporte"
pages.spells.descriptions.druid       → "Magias de cura e natureza"
pages.spells.descriptions.paladin     → "Magias de distância e suporte"
pages.spells.descriptions.knight      → "Magias de combate corpo-a-corpo"

pages.items.title                     → "Itens" / "Items"
pages.items.description               → "Explore todos os itens..."
pages.items.itemCount                 → "{count} itens" / "{count} items"
pages.items.categoryNotFound          → "Categoria não encontrada"
pages.items.backTo                    → "Voltar para itens"

pages.equipment.title                 → "Equipamentos" / "Equipment"
pages.equipment.description           → "Explore todos os equipamentos..."
pages.equipment.itemCount             → "{count} itens"
pages.equipment.categoryNotFound      → "Categoria não encontrada"
pages.equipment.backTo                → "Voltar para equipamentos"

pages.creatures.title                 → "Criaturas" / "Creatures"
pages.creatures.description           → "Lista completa de todas as criaturas..."

pages.calculatorsPage.title           → "Calculadoras" / "Calculators"
pages.calculatorsPage.description     → "Utilize nossas calculadoras..."
pages.calculatorsPage.cards.healDamage.title       → "Heal / Dano com Magias"
pages.calculatorsPage.cards.healDamage.description → "Calcule heal e dano de magias"
... (8 calculadoras)

pages.highscores.title                → "Ranking"
pages.highscores.category             → "Categoria"
pages.highscores.vocation             → "Vocação"
pages.highscores.errorLoading         → "Erro ao carregar ranking..."
pages.highscores.noPlayers            → "Nenhum jogador encontrado..."
pages.highscores.lastUpdated          → "Última atualização"
pages.highscores.columns.name         → "Nome"
pages.highscores.columns.level        → "Level"
pages.highscores.scoreLabels.experience → "Experiência"
pages.highscores.scoreLabels.magicLevel → "Magic Level"
pages.highscores.scoreLabels.skill    → "Skill"

pages.online.title                    → "Jogadores Online" / "Online Players"
pages.online.playerCount              → "{count} jogador(es) online"
pages.online.noPlayers                → "Nenhum jogador online no momento"
pages.online.autoUpdate               → "Os dados são atualizados automaticamente..."

pages.banned.title                    → "Banidos" / "Banned"
pages.banned.description              → "Lista de contas permanentemente banidas..."
pages.banned.banCount                 → "{count} conta(s) banida(s)"
pages.banned.noBans                   → "Nenhum banimento registrado"
pages.banned.freeOfCheaters           → "Relic está livre de trapaceiros!"
pages.banned.columns.date             → "Data"
pages.banned.columns.character        → "Personagem"
pages.banned.columns.level            → "Level"
pages.banned.columns.reason           → "Motivo"

pages.topGainers.title                → "Top Gainers"
pages.topGainers.description          → "Jogadores que mais ganharam experiência..."
pages.topGainers.period               → "Período"
pages.topGainers.xpRanking            → "Ranking de XP"
pages.topGainers.columns.name         → "Nome"
pages.topGainers.columns.vocation     → "Vocação"
pages.topGainers.columns.level        → "Nível"
pages.topGainers.columns.xpGained     → "XP Ganha"
pages.topGainers.columns.xpTotal      → "XP Total"
pages.topGainers.new                  → "NOVO"
pages.topGainers.noVocation           → "Sem vocação"
pages.topGainers.noData               → "Nenhum jogador ganhou XP neste período"
pages.topGainers.dataCollected        → "Os dados são coletados automaticamente..."
pages.topGainers.errorLoading         → "Erro ao carregar dados"
```

### Seção `tables` (nova)
```text
tables.searchSpell                    → "Buscar magia ou palavras..."
tables.searchItem                     → "Buscar item..."
tables.searchEquipment                → "Buscar equipamento..."
tables.searchCreature                 → "Buscar criatura..."
tables.showing                        → "Exibindo {shown} de {total}"
tables.showingSpells                  → "Exibindo {shown} de {total} magias"
tables.showingItems                   → "Exibindo {shown} de {total} itens"
tables.showingCreatures               → "Exibindo {shown} de {total} criaturas"
tables.clickForDetails                → "Clique em um item para mais detalhes"

tables.columns.img                    → "Img"
tables.columns.name                   → "Nome"
tables.columns.words                  → "Palavras"
tables.columns.magicLevel             → "Magic Lvl"
tables.columns.mana                   → "Mana"
tables.columns.price                  → "Preço"
tables.columns.type                   → "Tipo"
tables.columns.weight                 → "Peso"
tables.columns.duration               → "Duração"
tables.columns.slots                  → "Slots"
tables.columns.city                   → "Cidade"
tables.columns.protection             → "Proteção"
tables.columns.effect                 → "Efeito"
tables.columns.attributes             → "Atributos"
tables.columns.charges                → "Cargas"
tables.columns.armor                  → "Arm"
tables.columns.attack                 → "Atk"
tables.columns.defense                → "Def"
tables.columns.exp                    → "Exp"
tables.columns.hp                     → "HP"
tables.columns.summon                 → "Summon"
tables.columns.convince               → "Convince"

tables.spellTypes.attack              → "Ataque" / "Attack"
tables.spellTypes.healing             → "Cura" / "Healing"
tables.spellTypes.support             → "Suporte" / "Support"
tables.spellTypes.summon              → "Invocação" / "Summon"
tables.spellTypes.other               → "Outro" / "Other"

tables.itemValues.permanent           → "Permanente" / "Permanent"
tables.itemValues.slots               → "{count} slots"
```

### Seção `calculatorPages` (nova - para cada calculadora)
```text
calculatorPages.healDamage.title      → "Calculadora de Heal / Dano"
calculatorPages.healDamage.description → "Calcule o heal e dano de magias e runas..."
calculatorPages.healDamage.level      → "Level"
calculatorPages.healDamage.magicLevel → "Magic Level"
calculatorPages.healDamage.baseMin    → "Base Min"
calculatorPages.healDamage.baseMax    → "Base Max"
calculatorPages.healDamage.min        → "Min"
calculatorPages.healDamage.max        → "Max"
calculatorPages.healDamage.avg        → "Avg"
calculatorPages.healDamage.healingSpells → "Magias de Cura"
calculatorPages.healDamage.healingRunes  → "Runas de Cura"
calculatorPages.healDamage.attackRunes   → "Runas de Ataque"
calculatorPages.healDamage.attackSpells  → "Magias de Ataque"

calculatorPages.stats.title           → "Calculadora de Stats"
calculatorPages.stats.description     → "Calcule o HP, Mana e Capacidade..."
calculatorPages.stats.chooseVocation  → "Escolha sua Vocação"
calculatorPages.stats.characterLevel  → "Level do Personagem"
calculatorPages.stats.enterLevel      → "Digite seu level"
calculatorPages.stats.calculate       → "Calcular"
calculatorPages.stats.results         → "Resultados"
calculatorPages.stats.hp              → "Hit Points (HP)"
calculatorPages.stats.mp              → "Mana Points (MP)"
calculatorPages.stats.cap             → "Capacidade (CAP)"
calculatorPages.stats.totalLife       → "Vida total do personagem"
calculatorPages.stats.totalMana       → "Mana total do personagem"
calculatorPages.stats.carryWeight     → "Peso que pode carregar"

calculatorPages.loot.title            → "Calculadora de Loot"
calculatorPages.loot.description      → "Adicione os itens do seu loot..."
calculatorPages.loot.item             → "Item"
calculatorPages.loot.price            → "Preço"
calculatorPages.loot.qty              → "Qtd"
calculatorPages.loot.selectItem       → "Selecione um item"
calculatorPages.loot.addItem          → "Adicionar Item"
calculatorPages.loot.clearAll         → "Limpar Tudo"
calculatorPages.loot.total            → "Total"
calculatorPages.loot.summary          → "Resumo"

... (similar para as outras 5 calculadoras)
```

---

## Etapas de Implementação

### Fase 1: Atualizar Estrutura de Traduções (5 arquivos)
1. `src/i18n/types.ts` - Adicionar interfaces para `pages`, `tables`, `calculatorPages`
2. `src/i18n/translations/pt.ts` - Adicionar todas as traduções em português
3. `src/i18n/translations/en.ts` - Adicionar todas as traduções em inglês
4. `src/i18n/translations/es.ts` - Adicionar todas as traduções em espanhol
5. `src/i18n/translations/pl.ts` - Adicionar todas as traduções em polonês

### Fase 2: Atualizar Páginas Principais (9 arquivos)
Para cada página:
- Importar `useTranslation` de `@/i18n`
- Extrair `t` do hook
- Substituir todos os textos fixos por `t('chave')`

Arquivos:
1. `SpellsPage.tsx`
2. `ItemsPage.tsx`
3. `EquipmentPage.tsx`
4. `CreaturesPage.tsx`
5. `CalculatorsPage.tsx`
6. `HighscoresPage.tsx`
7. `OnlinePlayersPage.tsx`
8. `DeathRowPage.tsx`
9. `TopGainersPage.tsx`

### Fase 3: Atualizar Calculadoras (8 arquivos)
1. `HealDamageCalculator.tsx`
2. `PhysicalDamageCalculator.tsx`
3. `DeathExperienceCalculator.tsx`
4. `ExperienceLevelCalculator.tsx`
5. `MagicLevelCalculator.tsx`
6. `SkillsCalculator.tsx`
7. `StatsCalculator.tsx`
8. `LootCalculator.tsx`

### Fase 4: Atualizar Componentes de Tabela (4 arquivos)
1. `SpellsTable.tsx`
2. `ItemsTable.tsx`
3. `CreaturesTable.tsx`
4. `EquipmentTable.tsx`

---

## Padrão de Código

### Exemplo de uso em página:
```typescript
import { useTranslation } from '@/i18n';

const SpellsPage = () => {
  const { t } = useTranslation();

  return (
    <h1>{t('pages.spells.title')}</h1>
    <p>{t('pages.spells.description')}</p>
    <span>{t('pages.spells.spellCount').replace('{count}', spells.length.toString())}</span>
  );
};
```

### Exemplo de uso em tabela:
```typescript
import { useTranslation } from '@/i18n';

const SpellsTable = ({ spells }: SpellsTableProps) => {
  const { t } = useTranslation();

  const getTypeTranslation = (type: string | undefined) => {
    switch (type) {
      case 'Attack': return t('tables.spellTypes.attack');
      case 'Healing': return t('tables.spellTypes.healing');
      case 'Support': return t('tables.spellTypes.support');
      case 'Summon': return t('tables.spellTypes.summon');
      default: return t('tables.spellTypes.other');
    }
  };

  return (
    <Input placeholder={t('tables.searchSpell')} />
    <TableHead>{t('tables.columns.name')}</TableHead>
    <p>{t('tables.showingSpells').replace('{shown}', sorted.length).replace('{total}', spells.length)}</p>
  );
};
```

---

## Resumo

| Categoria | Quantidade |
|-----------|-----------|
| Arquivos de tradução a atualizar | 5 |
| Páginas principais | 9 |
| Calculadoras | 8 |
| Componentes de tabela | 4 |
| **Total de arquivos** | **26** |
| Novas chaves de tradução (estimativa) | ~150 por idioma |
| Idiomas suportados | 4 (PT, EN, ES, PL) |

Após a implementação, todas as páginas respeitarão o idioma selecionado no seletor de idiomas.
