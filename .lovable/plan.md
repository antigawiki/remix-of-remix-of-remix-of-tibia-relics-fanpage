
# Plano: Modal de Detalhes de Itens com Scraping do Tibiara

## Objetivo
Implementar funcionalidade de abrir um modal ao clicar em qualquer item da tabela de equipamentos, exibindo informações detalhadas obtidas dinamicamente do site tibiara.netlify.app, incluindo:
- Onde comprar/vender o item
- NPCs e precos
- Links para mapa de localizacao dos NPCs
- Monstros que dropam o item e chance de drop

---

## Arquitetura da Solucao

```text
+----------------+     +----------------------+     +------------------------+
|  EquipmentTable|     | Edge Function        |     | tibiara.netlify.app    |
|  (Click Item)  | --> | scrape-item-details  | --> | /en/pages/items/{item} |
+----------------+     +----------------------+     +------------------------+
        |                       |
        v                       v
+------------------+    +------------------+
| ItemDetailsModal |<-- | Parsed HTML Data |
| (UI Component)   |    | (JSON Response)  |
+------------------+    +------------------+
```

---

## Etapas de Implementacao

### 1. Criar Edge Function para Scraping
**Arquivo:** `supabase/functions/scrape-item-details/index.ts`

Responsabilidades:
- Receber nome do item como parametro
- Converter para formato URL (ex: "Viking Helmet" -> "viking_helmet")
- Fazer fetch da pagina do tibiara
- Fazer parsing do HTML para extrair:
  - Dados basicos (nome, imagem, stats)
  - Lista de NPCs que compram (cidade, npc, preco, coordenadas mapa)
  - Lista de NPCs que vendem (cidade, npc, preco, coordenadas mapa)
  - Lista de monstros que dropam (nome, imagem, quantidade, chance)
- Retornar dados estruturados em JSON

### 2. Criar Hook de Fetching
**Arquivo:** `src/hooks/useItemDetails.ts`

- Hook personalizado usando React Query
- Faz chamada para Edge Function
- Gerencia loading state e cache
- Tratamento de erros

### 3. Criar Componente Modal
**Arquivo:** `src/components/ItemDetailsModal.tsx`

Layout do modal:
```text
+------------------------------------------------+
| [Imagem] Nome do Item           [X]            |
|------------------------------------------------|
| Arm: 4 | Peso: 39 oz.                          |
|================================================|
| VENDER PARA                | COMPRAR DE        |
|---------------------------|-------------------|
| Cidade | NPC | Preco | Map| Cidade | NPC |Preco|
| Thais  |Hardek| 66gp | [M]| Darash |Azil| 265gp|
| ...    | ...  | ...  |    | ...    | ...| ...  |
|================================================|
| DROPADO POR                                    |
|------------------------------------------------|
| Monstro    | [img] | Qtd | Chance              |
| Ghoul      | [gif] | 1   | 5%                  |
| Skeleton   | [gif] | 1   | 8%                  |
+------------------------------------------------+
```

Caracteristicas:
- Estilo visual seguindo o tema retro/parchment do site
- Icone de mapa abrindo em nova aba para localizacao do NPC
- Indicador de loading enquanto busca dados
- Fallback para itens sem dados

### 4. Integrar no EquipmentTable
**Arquivo:** `src/components/EquipmentTable.tsx`

- Adicionar estado para item selecionado
- Tornar linhas da tabela clicaveis (cursor pointer, hover effect)
- Abrir modal ao clicar em qualquer linha
- Passar nome do item para o modal

---

## Detalhes Tecnicos

### Conversao de Nome para URL
```typescript
function itemNameToUrl(name: string): string {
  return name
    .toLowerCase()
    .replace(/'/g, '')  // Remove apostrofos (Ab'dendriel -> abdendriel)
    .replace(/\s+/g, '_');  // Espacos para underscore
}
// "Viking Helmet" -> "viking_helmet"
// "Hat of the Mad" -> "hat_of_the_mad"
```

### Parsing do HTML
O HTML do tibiara segue estrutura consistente:
- `table#oneitems` - dados basicos
- `table#sbileft` - NPCs que compram (Sell)
- `table#sbiright` - NPCs que vendem (Buy)
- `table#looted` - monstros que dropam
- Links de mapa contem coordenadas: `map/index.html#32270,32329,7:2`

### Estrutura de Dados Retornada
```typescript
interface ItemDetails {
  name: string;
  image: string;
  stats: {
    armor?: number;
    attack?: number;
    defense?: number;
    weight: string;
  };
  sellTo: Array<{
    city: string;
    npc: string;
    price: string;
    mapUrl?: string;
  }>;
  buyFrom: Array<{
    city: string;
    npc: string;
    price: string;
    mapUrl?: string;
  }>;
  lootedFrom: Array<{
    monster: string;
    image: string;
    amount: string;
    chance: string;
  }>;
}
```

---

## Arquivos a Criar/Modificar

| Acao | Arquivo | Descricao |
|------|---------|-----------|
| Criar | `supabase/functions/scrape-item-details/index.ts` | Edge function para scraping |
| Atualizar | `supabase/config.toml` | Registrar nova edge function |
| Criar | `src/hooks/useItemDetails.ts` | Hook para buscar detalhes |
| Criar | `src/components/ItemDetailsModal.tsx` | Modal com detalhes do item |
| Modificar | `src/components/EquipmentTable.tsx` | Tornar linhas clicaveis |

---

## Consideracoes

### Performance
- Cache via React Query (staleTime de 5 minutos)
- Lazy loading - so busca quando usuario clica
- Loading skeleton enquanto carrega

### Tratamento de Erros
- Alguns itens podem nao existir no tibiara (retorna 404)
- Modal exibe mensagem amigavel: "Detalhes nao disponiveis para este item"
- Fallback mostra apenas dados locais (armor, peso, etc)

### UX
- Feedback visual de hover na linha da tabela
- Loading spinner durante fetch
- Transicao suave de abertura do modal
- Icones de mapa abrem em nova aba
