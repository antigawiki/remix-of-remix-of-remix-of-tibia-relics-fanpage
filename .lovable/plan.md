

# Plano: Melhorar a Página de Comidas

## Resumo

A página de comidas já existe em `/items/foods` e está funcionando! A estrutura atual já tem 32 comidas cadastradas e já suporta todos os 4 idiomas. Porém, comparando com o site de referência, faltam 3 itens e podemos melhorar a ordenação.

---

## O Que Já Existe

| Item | Status |
|------|--------|
| Página de comidas | Existe em `/items/foods` |
| Dados de comidas | `src/data/items/foods.ts` com 32 itens |
| Componente de tabela | `ItemsTable.tsx` com busca e ordenação |
| Traduções | Todas as 4 línguas têm "Comidas" traduzido |

---

## Alterações Necessárias

### 1. Adicionar Comidas Faltantes

**Arquivo**: `src/data/items/foods.ts`

Adicionar 3 itens que estão no site de referência mas não no nosso:

| Nome | Peso | Duração | Imagem |
|------|------|---------|--------|
| Dough | 5 oz. | 0 sec | 207.gif |
| Flour | 5 oz. | 0 sec | 206.gif |
| Wheat | 12.5 oz. | 0 sec | 205.gif |

```typescript
// Adicionar ao final do array foods:
{ name: "Dough", image: "https://tibiara.netlify.app/en/img/food/207.gif", weight: "5 oz.", duration: "0 sec" },
{ name: "Flour", image: "https://tibiara.netlify.app/en/img/food/206.gif", weight: "5 oz.", duration: "0 sec" },
{ name: "Wheat", image: "https://tibiara.netlify.app/en/img/food/205.gif", weight: "12.5 oz.", duration: "0 sec" },
```

### 2. Adicionar Ordenação por Duração

**Arquivo**: `src/components/ItemsTable.tsx`

Atualmente a tabela permite ordenar por Nome e Peso. Vamos adicionar ordenação por Duração também.

**Alterações**:
- Expandir o tipo de `sortKey` para incluir `'duration'`
- Adicionar lógica de parsing para durações (converter "12 min 0 sec" para segundos)
- Adicionar cursor pointer e ícone de seta na coluna Duração

```typescript
// Alterar tipo de sortKey
const [sortKey, setSortKey] = useState<'name' | 'weight' | 'duration'>('name');

// Adicionar função de parsing de duração
const parseDuration = (duration: string): number => {
  if (!duration || duration === '-') return 0;
  let totalSeconds = 0;
  const minMatch = duration.match(/(\d+)\s*min/);
  const secMatch = duration.match(/(\d+)\s*sec/);
  if (minMatch) totalSeconds += parseInt(minMatch[1]) * 60;
  if (secMatch) totalSeconds += parseInt(secMatch[1]);
  return totalSeconds;
};

// Atualizar handleSort
const handleSort = (key: 'name' | 'weight' | 'duration') => { ... }

// Atualizar sortedItems para incluir duration
if (sortKey === 'duration') {
  comparison = parseDuration(a.duration || '0') - parseDuration(b.duration || '0');
}
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/data/items/foods.ts` | Adicionar 3 novos itens (Dough, Flour, Wheat) |
| `src/components/ItemsTable.tsx` | Adicionar ordenação por duração |

---

## Resultado Visual

A tabela de comidas terá:
- 35 itens (32 atuais + 3 novos)
- Ordenação clicável em 3 colunas: Nome, Peso, Duração
- Mesmo estilo visual atual com fundo pergaminho

---

## Resumo da Implementação

| Item | Quantidade |
|------|------------|
| Arquivos modificados | 2 |
| Novos itens | 3 |
| Linhas de código | ~30 linhas |
| Idiomas | Já suportados (items em inglês, UI traduzida) |

