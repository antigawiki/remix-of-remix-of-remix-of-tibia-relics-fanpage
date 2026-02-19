
# Hunt Administration Page — Plano de Implementação

## Visão Geral

Uma página de administração de hunts com acesso protegido por senha, sistema de fila de espera anônima, e notificações em tempo real via browser. A página será acessível por uma URL secreta (como o AltDetectorPage) e totalmente isolada do layout principal do site.

---

## Estrutura de Dados (Backend)

Serão criadas 3 novas tabelas no banco de dados:

### `hunt_cities`
| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| name | text | Nome da cidade |
| created_at | timestamptz | Data de criação |

### `hunt_spots`
| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| city_id | uuid | FK para hunt_cities |
| name | text | Nome do spot de hunt |
| max_duration_minutes | integer | Default 240 (4h) |
| created_at | timestamptz | — |

### `hunt_sessions`
| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| spot_id | uuid | FK para hunt_spots |
| player_name | text | Nick do player ativo |
| started_at | timestamptz | Início da hunt |
| ends_at | timestamptz | Término previsto (started_at + 4h) |
| status | text | `active`, `ending`, `finished` |
| notified_1h | boolean | Notificação de 1h enviada? |
| notified_15min | boolean | Notificação de 15min enviada? |
| created_at | timestamptz | — |

### `hunt_queue`
| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| spot_id | uuid | FK para hunt_spots |
| player_name | text | Nick do próximo player |
| position | integer | Posição na fila |
| status | text | `waiting`, `notified`, `claimed`, `expired` |
| notified_at | timestamptz | Hora que foi notificado |
| created_at | timestamptz | — |

**RLS:** Todas as tabelas com políticas restrictivas — somente leitura pública em campos não-sensíveis. Os nomes dos players **não serão expostos via query pública**, sendo filtrados no frontend pela senha.

---

## Arquitetura da Página

A página será uma **SPA autônoma** em `/hunt-admin` (URL sem destaque no menu, similar ao AltDetectorPage), com:

### 1. Tela de Login por Senha
- Campo de senha simples
- Senha `ondethweed` validada localmente (sem chamada ao backend — página administrativa interna)
- Senha salva em `sessionStorage` (expira ao fechar a aba)

### 2. Dashboard Principal
Após login, o layout terá:

**Painel Superior — Estatísticas rápidas**
- Cidades cadastradas
- Hunts ativas agora
- Spots disponíveis
- Total na fila (número apenas, sem nomes)

**Área Central — Cards por Cidade**
Cada cidade exibe seus spots em cards, mostrando:
- Nome do spot
- Status: `Livre`, `Em uso`, `Encerrando` (badge colorido)
- Timer em tempo real (countdown)
- Botão "Iniciar Hunt" (se livre)
- Botão "Encerrar Antecipado" (se ativo)
- Botão "Ver Fila (N)" — mostra quantidade sem revelar nomes para quem não tem acesso

**Painel de Fila**
- Lista de espera por spot com nomes visíveis (só após login com senha)
- Botão para adicionar nick à fila
- Botão para remover alguém da fila
- Exibição da posição de cada um

---

## Sistema de Notificações

Será implementado via **Web Notifications API** (notificações nativas do browser) combinado com **polling a cada 30s** no frontend:

### Fluxo de Notificações:

```text
Hunt Iniciada
     |
     ├─ 3h → verifica → 1h restante → Notifica admin + próximo da fila
     |                                "Faltam 60min para [Spot] em [Cidade]"
     |                                "Próximo da fila: prepare-se!"
     |
     ├─ 3h45 → verifica → 15min → Notifica admin + próximo da fila  
     |                            "15min restantes — hora de recolher o loot!"
     |                            "Próximo: sua vez em 15min!"
     |
     └─ 4h → Hunt encerrada automaticamente
```

### Lógica de Claimed (5 minutos):
- Quando o próximo da fila é notificado, ele tem 5 minutos para "clamar" sua vez
- Um botão **"Já estou indo!"** aparece na interface pública (via URL com token único)
- Se não clicar em 5 min, passa automaticamente para o próximo

---

## Páginas e Componentes a Criar

### Arquivos Novos:
1. `src/pages/HuntAdminPage.tsx` — Página principal com login + dashboard
2. `src/components/hunt/HuntCityCard.tsx` — Card de uma cidade com seus spots
3. `src/components/hunt/HuntSpotCard.tsx` — Card individual de um spot
4. `src/components/hunt/HuntQueuePanel.tsx` — Painel de fila de espera
5. `src/components/hunt/HuntTimer.tsx` — Componente de countdown em tempo real
6. `src/components/hunt/AddCityModal.tsx` — Modal para adicionar cidade
7. `src/components/hunt/AddSpotModal.tsx` — Modal para adicionar spot
8. `src/components/hunt/StartHuntModal.tsx` — Modal para iniciar hunt (pede nick)
9. `src/hooks/useHuntAdmin.ts` — Hook central com toda a lógica de negócio

### Arquivos Editados:
1. `src/App.tsx` — Adicionar a rota `/hunt-admin`
2. Migração SQL — Criar as 4 tabelas novas

---

## Features Extras (Bonus)

- **Histórico de hunts**: log simples dos últimos 10 players que usaram cada spot
- **Cor do timer**: verde (>1h), amarelo (15-60min), vermelho (<15min)
- **Badge "FILA: N"** no topo da página sempre visível, mesmo antes de logar
- **Auto-refresh** sem reload de página (polling com `setInterval`)
- **Proteção de nome**: na tela pública (sem login), o botão de fila mostra apenas "Ver fila (3)" sem nomes

---

## Sequência de Implementação

1. Criar migração SQL com as 4 tabelas e políticas RLS
2. Criar hook `useHuntAdmin.ts` com toda lógica (CRUD, timers, notificações)
3. Criar componentes sub-componentes (Timer, Cards, Modals)
4. Criar a `HuntAdminPage.tsx` com tela de login e dashboard
5. Registrar a rota em `App.tsx`
