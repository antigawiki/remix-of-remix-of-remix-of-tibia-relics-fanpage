

# Fix: Floors cobrindo interiores e transparencia de criaturas

## Diagnostico

### Problema 1: Interior de casas nao aparece (imagem 53)
O console mostra `cam=(32482,31611,6)` - camera no z=6 (dentro de uma construcao). O `getVisibleFloors` retorna floors [7, 6, 5, 4], desenhando floors 5 e 4 (telhados) POR CIMA do interior do floor 6. Resultado: o telhado cobre tudo, incluindo o player e o chao da casa.

Solucao: implementar deteccao de "first visible floor" igual ao OTClient. Verificar se ha tiles de chao (telhado) nos floors acima da camera. Se existirem, nao renderizar esses floors superiores.

### Problema 2: Players e criaturas "transparentes" (imagem 52 e 53)
Diretamente relacionado ao problema 1. Os tiles de telhado sendo desenhados por cima dos players criam a aparencia de transparencia. No floor 6, o player existe e tem outfit correto (console confirma looktypes validos: 128, 134, 138 com cores), mas os tiles de floors 5/4 cobrem visualmente.

### Problema 3: Opcode 0x6c (remove thing) ausente
O dispatch nao trata 0x6c (remover item/criatura de tile). Sem isso, tiles acumulam referencias antigas de criaturas, causando "fantasmas" e criaturas duplicadas.

## Mudancas

### A. `src/lib/tibiaRelic/renderer.ts` - Visibilidade de floors

Substituir `getVisibleFloors` por logica do OTClient:

1. Adicionar metodo `calcFirstVisibleFloor(z)`:
   - Para underground (z > 7): retorna max(z - 2, 8)
   - Para surface (z <= 7): 
     - Verificar tiles em area 3x3 ao redor da camera
     - Para cada floor acima (z-1, z-2, ...): checar se ha tiles de chao (telhado) tanto na posicao direta quanto na posicao com offset NW (diagonal -1,-1 por floor, como o `coveredUp` do OTClient)
     - Se encontrar tile com chao, definir firstFloor = esse floor + 1

2. Adicionar metodo `tileCoversFloor(items)`:
   - Retorna true se o tile contem items com `isGround === true` (flag 0x00 do dat)

3. Atualizar `getVisibleFloors`:
   - Surface: retornar floors de 7 ate firstVisibleFloor
   - Underground: manter logica atual

Logica baseada no OTClient `calcFirstVisibleFloor`:
```text
Para surface (z <= 7):
  firstFloor = 0
  Para cada pos em area 3x3 ao redor de (camX, camY):
    Para dz = 1 ate z:
      checkZ = z - dz
      // Posicao diretamente acima
      tile = getTile(camX+ix, camY+iy, checkZ)
      se tile tem ground -> firstFloor = max(firstFloor, checkZ + 1)
      // Posicao com offset NW (covered up)
      tile = getTile(camX+ix-dz, camY+iy-dz, checkZ)
      se tile tem ground -> firstFloor = max(firstFloor, checkZ + 1)
```

### B. `src/lib/tibiaRelic/packetParser.ts` - Adicionar opcode 0x6c

Adicionar handler para `delThing` (0x6c) no dispatch:
- Le pos3 (5 bytes) + stackPos (1 byte)
- Remove o item na posicao stackPos do tile correspondente
- O metodo `delThing` ja existe na classe (linhas 294-302) mas nao esta no dispatch

### C. Diagnostico adicional no renderer

Adicionar log temporario no primeiro frame renderizado para verificar:
- Quantidade de outfits carregados no dat
- Se os spriteIds referenciados existem no spr
- Isso ajudara a diagnosticar problemas residuais de sprites errados

## Impacto esperado

1. Dentro de casas/construcoes, o telhado nao sera mais desenhado por cima do interior
2. Players e NPCs deixarao de parecer transparentes quando estao sob teto
3. Tiles serao limpos corretamente quando itens/criaturas sao removidos (0x6c)
4. Na area aberta (sem telhado), o comportamento multi-floor continua normal

