

## Problema

A página de criaturas usa o layout com sidebars (200px + conteúdo + 200px), o que comprime a tabela. A coluna "Loot" tem texto longo que é cortado, e a coluna "Custom?" ocupa espaço sem agregar muito valor visual.

## Plano

### 1. Remover a coluna "Custom?" da tabela de criaturas
**Arquivo:** `src/components/CreaturesTable.tsx`
- Remover o `<TableHead>` da coluna "Custom?" (linha 88)
- Remover o `<TableCell>` correspondente (linhas 116-118)
- Criaturas custom podem ser indicadas de forma mais sutil, como um pequeno badge/icon ao lado do nome

### 2. Usar layout sem sidebars na página de criaturas
**Arquivo:** `src/pages/CreaturesPage.tsx`
- Alterar `<MainLayout>` para `<MainLayout showSidebars={false}>` — isso dá largura total ao conteúdo, como já é feito nas páginas de XP Tracker, Kill Statistics, etc.

### 3. Melhorar a coluna Loot
- Trocar `max-w-xs` por uma largura mais generosa e adicionar `truncate` com tooltip ou expandir o texto com quebra de linha controlada

Essas mudanças darão mais espaço horizontal para a tabela, eliminando o overflow da coluna Loot.

