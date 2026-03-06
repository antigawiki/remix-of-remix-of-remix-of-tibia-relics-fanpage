

# Plano: Fix do erro "Invalid supabaseUrl"

## Diagnóstico

O `.env` e o `client.ts` estão corretos. O erro ocorre porque o Vite não está injetando as variáveis de ambiente corretamente no build. Isso é um problema de cache do Vite — o `.vite/deps` está stale.

## Correção

Forçar um rebuild limpo adicionando uma mudança trivial no `vite.config.ts` (um novo comentário com timestamp) para invalidar o cache do Vite e forçar re-processamento das env vars.

### Arquivo: `vite.config.ts`
- Atualizar o comentário de rebuild trigger com um novo timestamp para forçar invalidação do cache

Isso é uma correção de 1 linha — apenas mudar o comentário existente na linha 6.

