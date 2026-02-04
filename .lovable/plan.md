

# Plano: Melhorar a Tabela de Itens com Ordenação por Duração e Modal de Detalhes

## Resumo

Vou adicionar duas funcionalidades à página de itens (foods):

1. **Ordenação por Duração**: Permitir clicar na coluna "Duração" para ordenar
2. **Modal de Detalhes**: Ao clicar em um item, abrir modal com informações de onde comprar/vender e quem dropa (igual ao EquipmentTable)

Também vou adicionar os 3 itens faltantes: Dough, Flour e Wheat.

---

## Alterações Necessárias

### 1. Adicionar Comidas Faltantes

**Arquivo**: `src/data/items/foods.ts`

Adicionar 3 itens que estão no site de referência:

| Nome | Peso | Duração |
|------|------|---------|
| Dough | 5 oz. | 0 sec |
| Flour | 5 oz. | 0 sec |
| Wheat | 12.5 oz. | 0 sec |

---

### 2. Atualizar ItemsTable com Ordenação por Duração e Modal

**Arquivo**: `src/components/ItemsTable.tsx`

Alterações:
- Expandir o tipo de `sortKey` para incluir `'duration'`
- Adicionar função `parseDuration()` para converter "12 min 0 sec" em segundos
- Adicionar cursor e ícone de seta na coluna Duração
- Adicionar estado para o modal (`selectedItem`, `modalOpen`)
- Tornar a linha clicável (cursor-pointer)
- Importar e usar o `ItemDetailsModal`

```typescript
// Novo tipo de sortKey
type SortKey = 'name' | 'weight' | 'duration';

// Nova função de parsing
const parseDuration = (duration: string): number => {
  if (!duration || duration === '-') return 0;
  let totalSeconds = 0;
  const minMatch = duration.match(/(\d+)\s*min/);
  const secMatch = duration.match(/(\d+)\s*sec/);
  if (minMatch) totalSeconds += parseInt(minMatch[1]) * 60;
  if (secMatch) totalSeconds += parseInt(secMatch[1]);
  return totalSeconds;
};

// Estados para o modal
const [selectedItem, setSelectedItem] = useState<Item | null>(null);
const [modalOpen, setModalOpen] = useState(false);

// Handler de clique na linha
const handleRowClick = (item: Item) => {
  setSelectedItem(item);
  setModalOpen(true);
};
```

---

### 3. Adaptar ItemDetailsModal para Aceitar Item

**Arquivo**: `src/components/ItemDetailsModal.tsx`

O modal atual usa o tipo `Equipment`. Preciso fazer ele aceitar também `Item`:

```typescript
// Alterar a interface para aceitar ambos os tipos
interface ItemDetailsModalProps {
  item: Equipment | Item | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

O hook `useItemDetails` já funciona com qualquer nome de item, então a edge function vai buscar os dados corretamente.

---

## Fluxo Visual

```
┌─────────────────────────────────────────────────┐
│ Tabela de Comidas                               │
├──────┬──────────┬─────────┬────────────────────┤
│ Img  │ Nome ↕   │ Peso ↕  │ Duração ↕          │
├──────┼──────────┼─────────┼────────────────────┤
│ 🍖   │ Dragon   │ 30 oz.  │ 12 min             │ ← Clicável
│      │ Ham      │         │                    │
├──────┼──────────┼─────────┼────────────────────┤
│ 🍞   │ Bread    │ 5 oz.   │ 2 min              │ ← Clicável
└──────┴──────────┴─────────┴────────────────────┘
                    │
                    ▼ Clique
┌─────────────────────────────────────────────────┐
│ 🍖 Dragon Ham                              [X]  │
├─────────────────────────────────────────────────┤
│ Peso: 30 oz.  |  Duração: 12 min                │
├─────────────────────────────────────────────────┤
│ 💰 Vender Para        │ 🛒 Comprar De           │
│ ┌─────────────────────┼───────────────────────┐ │
│ │ Cidade  NPC  Preço  │ Cidade  NPC  Preço    │ │
│ │ ...     ...  ...    │ ...     ...  ...      │ │
│ └─────────────────────┴───────────────────────┘ │
├─────────────────────────────────────────────────┤
│ 💀 Dropado Por                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ Monstro       Img  Qtd  Chance              │ │
│ │ Dragon        🐉   1    100%                │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/data/items/foods.ts` | Adicionar 3 novos itens (Dough, Flour, Wheat) |
| `src/components/ItemsTable.tsx` | Ordenação por duração + linha clicável + modal |
| `src/components/ItemDetailsModal.tsx` | Aceitar tipo `Item` além de `Equipment` |

---

## Detalhes Técnicos

### Colunas Ordenáveis
A coluna de duração será ordenável apenas quando a categoria tiver a coluna `duration` (foods e rings).

### Compatibilidade de Tipos
O `ItemDetailsModal` precisa ser compatível com ambos:
- `Equipment`: tem `armor`, `attack`, `defense`
- `Item`: tem `duration`, `slots`, `city`, `charges`

O modal já lida com campos opcionais, então vai funcionar para ambos os tipos.

### Edge Function
A edge function `scrape-item-details` já funciona para qualquer item, buscando na URL:
`https://tibiara.netlify.app/en/pages/items/{item_name}.html`

---

## Resumo da Implementação

| Item | Quantidade |
|------|------------|
| Arquivos modificados | 3 |
| Novos itens de comida | 3 |
| Funcionalidades novas | 2 (ordenação + modal) |
| Idiomas | Já suportados |

