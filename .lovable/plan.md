## Sistema de Enquetes Anonimas

### Visao Geral

Criar um sistema de enquetes (polls) onde usuarios votam anonimamente, com protecao contra voto duplicado via fingerprint do navegador (combinacao de IP + User-Agent hash). A primeira enquete sera "O que você mais quer ver por aqui?" com 4 opcoes.

### Banco de Dados

**Tabela `polls**` - Armazena as enquetes


| Coluna     | Tipo        | Descricao                                                          |
| ---------- | ----------- | ------------------------------------------------------------------ |
| id         | uuid (PK)   | ID da enquete                                                      |
| title      | text        | Titulo da enquete                                                  |
| options    | jsonb       | Array de opcoes (ex: `[{"key":"a","label":"Entrevista..."}, ...]`) |
| active     | boolean     | Se a enquete esta aberta para votos                                |
| created_at | timestamptz | Data de criacao                                                    |


**Tabela `poll_votes**` - Armazena os votos


| Coluna     | Tipo               | Descricao                                        |
| ---------- | ------------------ | ------------------------------------------------ |
| id         | uuid (PK)          | ID do voto                                       |
| poll_id    | uuid (FK -> polls) | Referencia a enquete                             |
| option_key | text               | Chave da opcao votada (a, b, c, d)               |
| voter_hash | text               | Hash anonimo (IP + User-Agent via edge function) |
| created_at | timestamptz        | Data do voto                                     |
| UNIQUE     | &nbsp;             | (poll_id, voter_hash) - impede voto duplicado    |


RLS: SELECT publico em ambas. INSERT em poll_votes publico. Sem UPDATE/DELETE para votos.

### Edge Function: `cast-vote`

- Recebe `poll_id` e `option_key`
- Extrai IP do request header + User-Agent
- Gera hash SHA-256 do combo (anonimo, nao reversivel)
- Insere na `poll_votes` com `ON CONFLICT` para rejeitar voto duplicado
- Retorna sucesso ou "ja votou"

### Frontend

**Componente `PollBox.tsx**`

- Exibe titulo da enquete e as opcoes como radio buttons no estilo retro do site (news-box style)
- Ao votar, chama a edge function
- Apos votar (ou se ja votou), mostra os resultados com barras de progresso e porcentagens
- Salva no localStorage que ja votou (UX hint, a protecao real e no backend)

**Integracao na Index.tsx**

- Adicionar o `PollBox` na pagina inicial, entre o Welcome e as News, com um section-divider

### Dados Iniciais

Inserir a primeira enquete via migration seed:

- Titulo: "O que voce mais quer ver por aqui?"
- Opcoes:
  - a: Entrevista com personagens do Relic
  - b: Jornal com um resumo do que aconteceu no servidor
  - c: Sistema de sugestoes e votacao da melhor sugestao pra ser levada ate a staff
  - d: Dicas de hunt

### Resumo de Arquivos


| Arquivo                                 | Acao                             |
| --------------------------------------- | -------------------------------- |
| Migration SQL                           | CRIAR tabelas polls e poll_votes |
| `supabase/functions/cast-vote/index.ts` | CRIAR edge function              |
| `src/components/PollBox.tsx`            | CRIAR componente                 |
| `src/hooks/usePoll.ts`                  | CRIAR hook para fetch/vote       |
| `src/pages/Index.tsx`                   | EDITAR - adicionar PollBox       |
