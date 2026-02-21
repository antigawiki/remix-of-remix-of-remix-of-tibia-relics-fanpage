
# Pagina de Sessoes do Jogador com Comparacao de Coincidencias

## Objetivo

Ao clicar no nome de um personagem (A ou B) na tabela de Suspeitos, navegar para uma pagina de detalhe que mostra todas as sessoes de login/logout desse jogador, comparando visualmente com as sessoes dos personagens com quem ele tem coincidencias.

## Mudancas

### 1. Nova pagina: `src/pages/AltPlayerSessionsPage.tsx`

- Recebe o nome do jogador via URL param (ex: `/d4f8a2c91b3e7f05a6d2e8b4c7f1a9e3/:playerName`)
- Busca todos os matches desse jogador na tabela `alt_detector_matches` (onde ele e player_a ou player_b)
- Busca as sessoes (`online_tracker_sessions`) do jogador e de todos os seus pares suspeitos
- Exibe uma timeline/tabela mostrando as sessoes do jogador principal com as sessoes coincidentes dos pares lado a lado
- Layout:
  - Header com nome do jogador e botao de voltar
  - Lista dos pares suspeitos com probabilidade (chips clicaveis para filtrar)
  - Tabela cronologica com colunas: Data/Hora Login, Data/Hora Logout, Duracao, e para cada par suspeito que teve sessao adjacente naquele periodo, mostrar o nome e horarios
  - Cores diferentes para cada par suspeito para facilitar visualizacao

### 2. Rota no `src/App.tsx`

- Adicionar rota: `/d4f8a2c91b3e7f05a6d2e8b4c7f1a9e3/:playerName`
- Importar o novo componente

### 3. Links clicaveis no `src/pages/AltDetectorPage.tsx`

- Transformar os nomes dos personagens nas celulas `player_a` e `player_b` da tabela de Suspeitos em links (`<Link>`) que navegam para a nova pagina
- Tambem nos cards de "Alts por Conta", tornar os nomes clicaveis

## Detalhes Tecnicos

### Queries na pagina de sessoes

```typescript
// 1. Buscar matches do jogador
const matches = await supabase
  .from('alt_detector_matches')
  .select('*')
  .or(`player_a.eq.${playerName},player_b.eq.${playerName}`)
  .order('probability', { ascending: false });

// 2. Buscar sessoes do jogador e de todos os pares
const allPlayers = [playerName, ...pairNames];
const sessions = await supabase
  .from('online_tracker_sessions')
  .select('*')
  .in('player_name', allPlayers)
  .order('login_at', { ascending: false })
  .limit(500);
```

### Layout da tabela de comparacao

Cada linha mostra uma sessao do jogador principal. Ao lado, mostra sessoes de outros jogadores que ocorreram em janela proxima (ex: +/- 5 minutos do login ou logout). Isso permite visualizar rapidamente quais sessoes foram adjacentes.

- Coluna "Jogador" (nome principal)
- Coluna "Login"
- Coluna "Logout"  
- Coluna "Duracao"
- Coluna "Coincidencias" - lista de chips com nome do par e horario de login/logout adjacente, coloridos por jogador

### Estilo dos links

Os nomes na tabela de suspeitos ficam com `cursor-pointer`, `hover:text-primary`, `hover:underline` para indicar que sao clicaveis, mantendo o estilo atual da pagina.
