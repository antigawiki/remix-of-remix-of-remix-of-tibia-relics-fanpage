
# Plano: Corrigir Página de Runas

## Problemas Identificados

### 1. Breadcrumbs Duplicados
O `MainLayout.tsx` já inclui o `Breadcrumb` automaticamente (linha 27), mas o `RunesPage.tsx` adiciona outro manualmente (linha 11). Isso causa a duplicação visível na imagem.

### 2. Imagens Não Carregando
Vários IDs no arquivo `runes.ts` estão incorretos. Os IDs precisam corresponder aos nomes dos arquivos `.gif` no servidor de referência. Comparando os arquivos HTML fornecidos com os IDs atuais:

| Rune | ID Atual (errado) | ID Correto |
|------|-------------------|------------|
| Chameleon | chameleon | ca |
| Convince Creature | convince | co |
| Animate Dead | adead | dead |
| Desintegrate | des | desintegrate |
| Poisonbomb | pob | pb |
| Firebomb | fib | fbo |
| Poison Wall | pow | pw |
| Fire Wall | fiw | fw |
| Energy Bomb | enb | eb |
| Energy Wall | enw | ew |
| Explosion | exp | ex |
| Paralyze | paralyze | paraliz |
| Magic Wall | mw | mw (correto) |
| Envenom | envenom | envenom (correto) |

### 3. Modal Sem Dados de Produção
A Edge Function `scrape-rune-details` está usando regex incorretos para o HTML real. O HTML do site tem uma estrutura diferente do que o parser espera:

**Estrutura real do HTML:**
```html
<table id="monster">
  <tr><td>
    <table id="sbileft">
      <tr>
        <td>Backpack of:</td>
        <td>VOC.</td>
        <td>time to do</td>  <!-- Header -->
      </tr>
      <tr>
        <td><img src="backpack+rune"></td>
        <td>Druid</td>        <!-- Vocação -->
        <td>1 h. 40 min. 0 sec.</td>  <!-- Tempo -->
      </tr>
    </table>
  </td></tr>
</table>
<table id="runes">
  <tr><th>needed food to be done:</th></tr>
  <tr>
    <td><img src="food.gif"><br> x 9</td>  <!-- Formato: imagem + quantidade -->
    ...
  </tr>
</table>
```

O parser atual busca `Time</td>` e classes `title` que não existem.

---

## Alterações Necessárias

### Arquivo 1: `src/pages/RunesPage.tsx`
**Problema**: Breadcrumb duplicado

**Solução**: Remover a linha `<Breadcrumb />` (linha 11) pois o MainLayout já adiciona automaticamente.

---

### Arquivo 2: `src/data/runes.ts`
**Problema**: IDs e URLs de imagem incorretos

**Solução**: Corrigir os IDs de 12 runas:

```typescript
// Mudanças nos IDs:
{ id: 'ca', name: 'Chameleon', image: '.../runes/ca.gif' }
{ id: 'co', name: 'Convince Creature', image: '.../runes/co.gif' }
{ id: 'dead', name: 'Animate Dead', image: '.../runes/dead.gif' }
{ id: 'desintegrate', name: 'Desintegrate', image: '.../runes/desintegrate.gif' }
{ id: 'pb', name: 'Poisonbomb', image: '.../runes/pb.gif' }
{ id: 'fbo', name: 'Firebomb', image: '.../runes/fbo.gif' }
{ id: 'pw', name: 'Poison Wall', image: '.../runes/pw.gif' }
{ id: 'fw', name: 'Fire Wall', image: '.../runes/fw.gif' }
{ id: 'eb', name: 'Energy Bomb', image: '.../runes/eb.gif' }
{ id: 'ew', name: 'Energy Wall', image: '.../runes/ew.gif' }
{ id: 'ex', name: 'Explosion', image: '.../runes/ex.gif' }
{ id: 'paraliz', name: 'Paralyze', image: '.../runes/paraliz.gif' }
```

---

### Arquivo 3: `supabase/functions/scrape-rune-details/index.ts`
**Problema**: Parsing incorreto do HTML

**Solução**: Reescrever o parser para extrair dados corretamente:

1. **Extrair vocações e tempo**: Procurar dentro de `<table id="sbileft">` a segunda `<tr>` que contém:
   - `<td>` com vocação (ex: "Druid", "Sorcerer", "Druid</br>Sorcerer")
   - `<td>` com tempo (ex: "1 h. 40 min. 0 sec.")

2. **Extrair comidas**: Procurar em `<table id="runes">` os `<td>` com padrão:
   - `<img src="img/food/xxx.gif"><br> x NN`

3. **Nova estratégia de parsing**:
```typescript
// 1. Dividir HTML pelos blocos de vocation (table#monster seguido de table#runes)
// 2. Para cada bloco:
//    - Extrair vocação do <td> após "VOC."
//    - Extrair tempo do <td> após "time to do"
//    - Extrair foods do table#runes seguinte
// 3. Mapear nomes das comidas pelos IDs de imagem
```

Atualizar o mapeamento de comidas:
```typescript
const foodNameMap = {
  'dragon_meat.gif': 'Dragon Ham',
  '199.gif': 'Ham',
  '620.gif': 'Brown Mushroom',
  '200.gif': 'Meat',
  '194.gif': 'Fish',
  '344.gif': 'White Mushroom',
  '203.gif': 'Roast Pork',
};
```

---

## Resumo das Alterações

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `src/pages/RunesPage.tsx` | Modificar | Remover Breadcrumb duplicado |
| `src/data/runes.ts` | Modificar | Corrigir 12 IDs de runas e URLs de imagem |
| `supabase/functions/scrape-rune-details/index.ts` | Reescrever | Novo parser para estrutura HTML correta |

---

## Detalhes Técnicos do Novo Parser

A lógica do novo parser será:

1. **Dividir por tabelas `#monster`**: Cada tabela representa uma vocação
2. **Para cada seção**:
   - Extrair texto das `<td>` dentro de `#sbileft`
   - Identificar vocação pelo conteúdo (pode ter múltiplas separadas por `</br>`)
   - Identificar tempo pelo formato "X h. Y min. Z sec."
3. **Após cada `#monster`**, encontrar o próximo `#runes`:
   - Extrair todos os `<td>` com imagens
   - Parsear quantidade do texto " x NN"
4. **Mapear imagens para nomes** usando o dicionário foodNameMap

Este novo parser vai funcionar com a estrutura real do HTML fornecido no arquivo `runes_all_pages.txt`.
