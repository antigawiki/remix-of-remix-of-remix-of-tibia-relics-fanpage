
# Corrigir Calculadora de Skills - 2 Bugs

## Bugs Encontrados

### Bug 1: Constante A errada para cada tipo de skill
O codigo usa `A=50` para todas as skills, mas segundo a formula oficial do Tibia (tibia.fandom.com/wiki/Formulae), cada skill tem uma constante diferente:

| Skill | Constante A (correta) | Valor atual (errado) |
|---|---|---|
| Melee (Axe/Club/Sword) | 50 | 50 |
| Distance Fighting | **30** | 50 |
| Shielding | **100** | 50 |

### Bug 2: Significado do % invertido
O campo "% para Proxima" representa **quanto falta** para subir de skill (porcentagem restante), mas o codigo trata como porcentagem ja concluida.

- Valor atual: `totalTries * (1 - percentage/100)` (trata % como "feito")
- Valor correto: `totalTries * (percentage/100)` (trata % como "restante")

### Validacao com opentibia.info
Paladin, Distance, skill 62, 27% restante, alvo 63:
- Correto: `30 * 1.1^52 * 0.27 = 1150 hits`, `1150 * 2 = 2300 sec = 38min 20sec` (igual opentibia)
- Atual (errado): `50 * 1.1^52 * 0.73 = 5184 hits`, `5184 * 2 = 10369 sec = 2h52min`

## Alteracoes

### Arquivo: `src/data/calculators/skills.ts`

1. Adicionar constantes A por tipo de skill ao modelo de dados (skillConstants: melee=50, distance=30, shielding=100)
2. Alterar `calculateSkillTime` para receber o parametro `skillConstant` (A) ao inves de usar 50 fixo
3. Inverter a formula do percentual: de `(1 - percentage/100)` para `(percentage/100)`
4. Atualizar `calculateSkills` para passar a constante A correta baseada no tipo de skill

### Detalhes tecnicos da formula corrigida

```text
// Para o primeiro nivel (parcial baseado no % restante):
tries_remaining = A * b^(skill - 10) * (percentage / 100)

// Para niveis intermediarios (completos):
tries_full = A * b^(skill - 10)

// Tempo: tries * 2 segundos
```

Onde A varia por tipo de skill (50, 30, ou 100) e b e o multiplicador da vocacao.
