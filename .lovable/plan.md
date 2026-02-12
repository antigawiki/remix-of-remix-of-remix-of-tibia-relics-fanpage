

# Corrigir Calculadora de Skills + Adicionar Campo de Porcentagem

## Problema Atual

A fórmula atual da calculadora de skills está incorreta. Ela usa `base * Math.pow(exponent, skill - 9)` diretamente como segundos, mas a fórmula correta do Tibia 7.4 calcula **tentativas (tries)** necessárias para avançar, e cada tentativa leva **2 segundos** (1 round de combate).

A fórmula correta do Tibia 7.4 para skills e:

```text
Tentativas para avançar do skill X para X+1 = 50 * vocation_multiplier^(skill - 10)
Tempo em segundos = tentativas * 2
```

Alem disso, falta o campo de **porcentagem (%)** de progresso na skill atual, como existe no site opentibia.info.

## Alteracoes

### 1. Corrigir a fórmula de cálculo (`src/data/calculators/skills.ts`)

- Mudar a fórmula para: `tries = 50 * vocation_multiplier^(skill - 10)`, `seconds = tries * 2`
- Atualizar os dados de vocação para usar apenas o **multiplicador** (exponent) por skill, já que A=50 é constante
- Adicionar suporte ao parâmetro de **porcentagem**: se o jogador já tem 60% de progresso na skill atual, só precisa de 40% das tentativas daquele nível
- Corrigir a função `formatTime` para usar traduções ao invés de texto fixo em português

### 2. Adicionar campo de % na UI (`src/pages/calculators/SkillsCalculator.tsx`)

- Adicionar um campo de input numérico (0-99) para a porcentagem de cada skill, ao lado dos campos existentes
- Layout: 3 colunas (Skill Atual | % | Skill Desejada)
- Seguir o mesmo padrão visual já usado na calculadora de Magic Level

### 3. Adicionar traduções

- Adicionar chave `percentToNext` nas traduções de skills (pt, en, es, pl)
- Adicionar na interface `types.ts`

## Detalhes Técnicos

### Parâmetros corretos por vocação (Tibia 7.4, rate 1x):

```text
                    Melee   Distance   Shield
Knight:              1.1      1.4       1.1
Paladin:             1.2      1.1       1.1
Sorcerer:            2.0      2.0       1.5
Druid:               1.8      1.8       1.5
```

A = 50 (constante para todas as skills)
c = 10 (skill de referência)

### Fórmula com porcentagem:

```text
// Para o primeiro nível (parcial):
tries_first_level = 50 * b^(currentSkill - 10) * (1 - percentage/100)

// Para os níveis seguintes (completos):
tries_remaining = sum(50 * b^(skill - 10)) para skill = currentSkill+1 até desiredSkill-1

// Total de tentativas:
total_tries = tries_first_level + tries_remaining

// Tempo total:
total_seconds = total_tries * 2
```

### Arquivos a modificar:

| Arquivo | Alteração |
|---------|-----------|
| `src/data/calculators/skills.ts` | Corrigir fórmula, atualizar multiplicadores, suporte a % |
| `src/pages/calculators/SkillsCalculator.tsx` | Adicionar campo de %, passar para o cálculo |
| `src/i18n/types.ts` | Adicionar chave `percentToNext` |
| `src/i18n/translations/pt.ts` | Adicionar tradução |
| `src/i18n/translations/en.ts` | Adicionar tradução |
| `src/i18n/translations/es.ts` | Adicionar tradução |
| `src/i18n/translations/pl.ts` | Adicionar tradução |

