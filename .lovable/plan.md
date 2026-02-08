
# Plano: Modo Flutuante Aprimorado com Informações de Level

## Visão Geral

Vamos expandir o painel Picture-in-Picture (modo flutuante) do XP Tracker web para incluir informações detalhadas sobre o progresso do level atual, utilizando as funções de cálculo já existentes na calculadora de experiência.

## Novas Informações a Adicionar

O painel flutuante passará a exibir:

1. **Barra de Progresso do Level** - Mostra visualmente quanto XP já tem no nível atual
2. **Level Atual** - Exibe o nível atual do personagem
3. **XP Restante** - Quanto XP falta para o próximo nível
4. **Tempo Estimado** - Quanto tempo falta para upar (baseado no XP/h atual)
5. **Horário Aproximado** - Hora estimada do level up (ex: "~15:42")

## Layout Proposto do PiP

O painel será redimensionado de 340x120 para 380x180 para acomodar as novas informações:

```text
┌─────────────────────────────────────────────────────────────────┐
│ [Logo]  XP: 1.328.800                                           │
│         +25.5k    130k/h     ⏱ 45m 32s                          │
├─────────────────────────────────────────────────────────────────┤
│ Level 85 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◌◌◌ 67.3%                │
│ Faltam: 156.200 XP  ·  ~1h 12m  ·  Às 15:42                    │
└─────────────────────────────────────────────────────────────────┘
```

## Detalhes Técnicos

### Modificações em PipPanel.tsx

1. **Importar funções de cálculo:**
   - `getLevelFromExperience` - Calcular nível atual
   - `calculateExperienceForLevel` - XP necessária para cada nível
   - `getLevelProgress` - Progresso percentual no nível

2. **Novos cálculos no componente:**
   - `currentLevel` = nível baseado no XP atual
   - `xpForNextLevel` = XP total para próximo nível
   - `xpRemaining` = XP que falta para upar
   - `progressPercent` = progresso no nível atual (0-100%)
   - `timeToLevelUp` = xpRemaining / xpPerHour (em horas)
   - `estimatedLevelUpTime` = hora atual + tempo estimado

3. **Novos estilos CSS para o PiP:**
   - `.level-section` - Container da seção de level
   - `.progress-bar` - Barra de progresso visual
   - `.progress-fill` - Preenchimento animado da barra
   - `.level-stats` - Estatísticas de tempo e XP restante

4. **Dimensões atualizadas:**
   - Largura: 340px → 380px
   - Altura: 120px → 180px

### Lógica de Cálculo do Tempo

```text
Se XP/h > 0:
  horasRestantes = xpRestante / xpPorHora
  tempoRestante = formatar em "Xh Ym"
  horarioEstimado = horaAtual + horasRestantes
Senão:
  Exibir "--" para tempo e horário
```

### Cores Utilizadas (padrão medieval)

- **Barra de progresso**: Gradiente dourado (#ffd700 → #f59e0b)
- **Level**: Dourado (#ffd700)
- **XP Restante**: Vermelho suave (#ef4444)
- **Tempo restante**: Azul (#60a5fa)
- **Horário**: Verde (#4ade80)

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/xp-tracker/PipPanel.tsx` | Adicionar cálculos de level, barra de progresso e estilos CSS |

## Comportamento Especial

- Se o XP/h for 0 (jogador parado), os campos de tempo mostrarão "--"
- Se o XP atual for nulo, toda a seção de level será ocultada
- A barra de progresso terá animação suave ao atualizar
