

## Diagnóstico e Solução

O problema é o bloco `define` no `vite.config.ts`. Usar `define` para sobrescrever `import.meta.env.VITE_*` **conflita com o mecanismo nativo do Vite** de injeção de variáveis de ambiente do `.env`. Isso pode fazer com que os valores sejam substituídos por `undefined` ou causar erros silenciosos que impedem a renderização do app.

A evidência: o session replay mostra a página carregando apenas estilos Tailwind CSS (via CDN fallback), sem nenhum conteúdo React renderizado, e zero erros JS no console — indicando que o app silenciosamente falha ao inicializar.

## Plano

### 1. Limpar o `vite.config.ts`
Remover o bloco `define` e o `optimizeDeps: { force: true }` — voltar à configuração limpa original. O Vite já lê o `.env` automaticamente e expõe variáveis `VITE_*` via `import.meta.env` sem necessidade de configuração extra.

**Arquivo:** `vite.config.ts`
- Remover linhas 18-24 (bloco `define` e `optimizeDeps`)
- Resultado final: configuração padrão com apenas `server`, `plugins`, `resolve`

### 2. Verificar se o preview carrega
Após a limpeza, o Vite usará o `.env` nativo que já contém os valores corretos de `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.

