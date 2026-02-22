
# Pagina de Houses (Casas) - 4 Idiomas

## Resumo

Criar uma pagina completa de Houses no estilo da pagina de Highscores, com filtros por cidade, tipo (Houses and Flats / Guildhalls) e status (All / Auctioned / Rented). A tabela tera ordenacao por nome, camas, tamanho e preco (rent).

---

## Estrutura da API

**Endpoint:** `https://api.tibiarelic.com/api/Houses?worldName=Relic&status={status}&type={type}&town={town}`

Parametros:
- `type`: `HousesAndFlats` ou `GuildHalls`
- `status`: `All`, `Auctioned` ou `Rented`  
- `town`: nome da cidade (opcional, se omitido retorna todas)

Cada house retorna:
- `houseId`, `name`, `description`, `size` (sqm), `rent` (gold), `town`, `guildHouse`
- `status`: `{ type: "auctioned"|"rented", bidAmount, bidLimit, finishTime }`
- Numero de camas extraido do campo `description` (ex: "This guildhall has ten beds.")

---

## Arquivos a Criar

### 1. `src/hooks/useHouses.ts`
- Hook com `useQuery` que chama o proxy
- Recebe parametros: `type`, `status`, `town`
- Interface `House` com todos os campos da API
- Funcao auxiliar para extrair numero de camas do `description`

### 2. `src/pages/HousesPage.tsx`
- Layout com `MainLayout` (com sidebars, igual Highscores)
- Icone de casa (Home do lucide)
- **3 filtros Select** no topo:
  - Cidade: All, Ab'Dendriel, Ankrahmun, Carlin, Darashia, Edron, Kazordoon, Liberty Bay, Port Hope, Svargrond, Thais, Venore, Yalahar
  - Tipo: Houses and Flats, Guildhalls
  - Status: All, Auctioned, Rented
- **Tabela com colunas**: Nome, Cidade, Tamanho (sqm), Camas, Aluguel (gold), Status
- **Ordenacao** clicavel em todas as colunas numericas + nome
- **Busca** por nome de house
- Linhas com status "rented" destacadas visualmente
- Houses em leilao mostram valor do bid e tempo restante

---

## Arquivos a Modificar

### 3. `supabase/functions/tibia-relic-proxy/index.ts`
- Novo case `houses` no switch
- Passa parametros `type`, `status` e `town` para a URL da API

### 4. `src/App.tsx`
- Nova rota: `/houses` -> `<HousesPage />`

### 5. `src/components/Sidebar.tsx`
- Novo link "Houses" / "Casas" no menu de navegacao (com icone Home)

### 6. `src/components/Header.tsx`
- Adicionar link "Houses" no menu mobile

### 7. `src/i18n/types.ts`
- Novas chaves em `navigation.houses`
- Novo bloco `pages.houses` com: title, description, filters (town, type, status), colunas da tabela, status labels, etc.

### 8. Traducoes (4 arquivos)
- `src/i18n/translations/pt.ts` - "Casas"
- `src/i18n/translations/en.ts` - "Houses"
- `src/i18n/translations/es.ts` - "Casas"
- `src/i18n/translations/pl.ts` - "Domy"

---

## Detalhes Tecnicos

### Extracao do numero de camas
O campo `description` contem texto como "This guildhall has **ten** beds." O numero esta por extenso. Sera criado um mapa de palavras em ingles para numeros (one=1, two=2, ..., thirty=30) para parsear automaticamente. Fallback para 0 se nao encontrar.

### Ordenacao
A tabela tera state local `sortField` e `sortDirection`. Clicar no header da coluna alterna asc/desc. Colunas ordenáveis: name, town, size, beds (extraido), rent.

### Proxy
```text
case "houses": {
  const type = url.searchParams.get("type") || "HousesAndFlats";
  const status = url.searchParams.get("status") || "All";
  const town = url.searchParams.get("town") || "";
  apiUrl = `${API_BASE}/Houses?worldName=Relic&type=${type}&status=${status}${town ? `&town=${town}` : ''}`;
  break;
}
```

### Estrutura visual
Segue o mesmo padrao da pagina de Highscores:
- `wood-panel` container
- `news-box-header` no topo
- Filtros em `flex flex-wrap gap-4`
- Tabela padrao do projeto (`Table`, `TableRow`, etc.)
- Skeleton loading e estado vazio com traducao
