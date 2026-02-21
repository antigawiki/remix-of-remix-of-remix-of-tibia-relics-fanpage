
# Corrigir Logica de Coincidencias na Pagina de Sessoes

## Problema

A logica atual de deteccao de adjacencia compara os timestamps de forma cruzada demais, gerando falsos positivos. Ela verifica:
- `pLogin vs logoutTime` (correto - par logou quando jogador deslogou)
- `pLogin vs loginTime` (incorreto - ambos logando juntos nao e padrao de alt)
- `pLogout vs loginTime` (correto - par deslogou quando jogador logou)
- `pLogout vs logoutTime` (incorreto - ambos deslogando juntos nao e padrao de alt)

Isso faz com que sessoes com 30 minutos de diferenca aparecam como coincidencias quando nao deveriam.

## Logica Correta

Para deteccao de alts, o padrao relevante e "um sai, outro entra":
1. **Par logou proximo ao logout do jogador** = jogador saiu, par entrou (login adjacente)
2. **Par deslogou proximo ao login do jogador** = par saiu, jogador entrou (logout adjacente)

Apenas essas duas comparacoes devem ser feitas, nao as 4 combinacoes cruzadas.

## Mudanca

### Arquivo: `src/pages/AltPlayerSessionsPage.tsx`

Linhas 150-151 - Simplificar a logica de adjacencia:

**Antes:**
```text
const loginAdjacent = Math.abs(pLogin - logoutTime) <= ADJACENCY_WINDOW_MS || Math.abs(pLogin - loginTime) <= ADJACENCY_WINDOW_MS;
const logoutAdjacent = pairS.logout_at && (Math.abs(pLogout - loginTime) <= ADJACENCY_WINDOW_MS || Math.abs(pLogout - logoutTime) <= ADJACENCY_WINDOW_MS);
```

**Depois:**
```text
const loginAdjacent = Math.abs(pLogin - logoutTime) <= ADJACENCY_WINDOW_MS;
const logoutAdjacent = pairS.logout_at && Math.abs(pLogout - loginTime) <= ADJACENCY_WINDOW_MS;
```

Isso garante que so sejam marcadas coincidencias quando ha o padrao real de "um sai, outro entra" dentro da janela de 5 minutos.
