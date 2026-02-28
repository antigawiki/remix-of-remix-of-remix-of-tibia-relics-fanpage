

## Plano: Restaurar Informacoes do Mapa (Relaxar Filtro de stackPrio)

### Problema
O filtro atual `stackPrio <= 1` e muito agressivo. Ele mantem apenas chao (0) e bordas (1), removendo elementos importantes como paredes, arvores, escadas, objetos grandes e outros itens estruturais que tem `stackPrio` 2 ou 3.

### Valores de stackPrio no Tibia 7.x

```text
0 = Ground (chao, grama, lava, agua)
1 = Borders (bordas de terreno, transicoes)
2 = Bottom (paredes, arvores, objetos grandes, escadas)
3 = Top (itens acima do jogador, telhados)
5 = Default (itens soltos, loot, cadaveres, objetos interativos)
```

### Solucao

Mudar o filtro de `stackPrio <= 1` para `stackPrio <= 3` no `mapTileRenderer.ts`. Isso mantem todos os elementos estruturais do mapa (chao, bordas, paredes, arvores, escadas) e filtra apenas itens soltos/loot/cadaveres (stackPrio 5) que sao os que realmente poluem quando acumulados de multiplas .cam.

### Detalhe Tecnico

**Arquivo: `src/lib/tibiaRelic/mapTileRenderer.ts`** (linha 91)

Alterar:
```text
if (def.stackPrio > 1) continue;
```
Para:
```text
if (def.stackPrio > 3) continue;
```

### Resultado
O mapa tera chao + bordas + paredes + arvores + escadas + objetos estruturais, sem lixo de itens soltos acumulados de multiplas gravacoes. As criaturas continuam sendo exibidas normalmente por cima.
