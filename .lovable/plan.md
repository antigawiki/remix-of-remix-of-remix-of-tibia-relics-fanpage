

# Atualizar Lista de Criaturas

## Resumo

Adicionar 16 novas criaturas ao arquivo `src/data/creatures.ts`, atualizar 1 criatura existente (Tarantula), e copiar a imagem do Ice Beetle para o projeto.

## Novas Criaturas a Adicionar

| Criatura | HP | EXP | Summon | Convince |
|---|---|---|---|---|
| Ice Beetle | 360 | 180 | - | - |
| Sibang | 225 | 105 | - | - |
| Kongra | 340 | 115 | - | - |
| Merlkin | 230 | 145 | - | - |
| Centipede | 70 | 30 | 335 | 335 |
| Carniphila | 255 | 150 | 490 | 490 |
| Flamingo | 25 | 0 | 250 | 250 |
| Crab | 55 | 30 | 305 | 305 |
| Panda | 80 | 3 | 300 | 300 |
| Crocodile | 105 | 40 | 350 | 350 |
| Elephant | 320 | 160 | 500 | 500 |
| Terror Bird | 300 | 150 | 490 | 490 |
| Spit Nettle | 150 | 20 | - | - |
| Hydra | 2350 | 2100 | - | - |
| Lizard Templar | 410 | 155 | - | - |
| Lizard Sentinel | 265 | 110 | 560 | 560 |
| Lizard Snakecharmer | 325 | 210 | - | - |

## Criaturas Ja Existentes (sem duplicar)

- **Slime** - ja existe, dados corretos
- **Hunter** - ja existe, dados corretos
- **Tarantula** - ja existe, mas summon/convince precisa atualizar de 480 para 485

## Alteracoes

### 1. Copiar imagem do Ice Beetle
- Copiar `user-uploads://132.png` para `public/creatures/ice_beetle.png`

### 2. Atualizar `src/data/creatures.ts`
- Adicionar as 16 novas criaturas listadas acima em ordem alfabetica
- Atualizar Tarantula: summon e convince de 480 para 485
- Usar imagens do wiki (`https://wiki.antiga.online/creatures/nome.png`) para as novas criaturas, exceto Ice Beetle que usara a imagem local

