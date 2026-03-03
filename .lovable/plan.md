

## Capturar tiles de TODOS os andares visiveis, nao so o do player

### Problema

Atualmente, `snapshotTiles` tem `if (tz !== camZ) continue;` — isso descarta tiles de todos os andares que nao sao o andar da camera. Porem, o protocolo Tibia envia dados de multiplos andares simultaneamente:

- **Superficie (camZ <= 7)**: le andares 0 a 7 (8 andares)
- **Subsolo (camZ > 7)**: le andares camZ-2 a camZ+2 (5 andares)

O parser `readMultiFloorArea` ja armazena esses tiles com coordenadas mundo corretas (X e Y ja incluem o perspective offset `camZ - nz`). Entao tiles de outros andares tem coordenadas validas — estamos jogando dados fora sem necessidade.

### Solucao

Substituir o filtro `tz !== camZ` por um filtro de **range de andares visiveis**, usando a mesma logica do `getFloorRange`:

```text
Se camZ <= 7:  aceitar andares 0 a 7
Se camZ > 7:   aceitar andares camZ-2 a camZ+2
```

Isso captura dados de todos os andares que o protocolo realmente enviou, sem risco de contaminar com andares fora do range visivel.

### Mudancas em `src/lib/tibiaRelic/mapExtractor.ts`

**Unica mudanca**: No `snapshotTiles`, substituir:

```javascript
// Only capture tiles on the camera's current floor.
if (tz !== camZ) continue;
```

Por:

```javascript
// Only capture tiles within the visible floor range
if (camZ <= 7) {
  // Surface: protocol sends floors 0-7
  if (tz < 0 || tz > 7) continue;
} else {
  // Underground: protocol sends camZ-2 to camZ+2
  if (tz < camZ - 2 || tz > camZ + 2 || tz > 15) continue;
}
```

Nenhuma outra mudanca necessaria. O `gs.tiles.clear()` no floor change continua funcionando — ao mudar de andar, os tiles antigos sao limpos e o proximo `readMultiFloorArea` popula com dados frescos de todos os andares visiveis do novo andar.

### Por que isso e seguro

1. **Coordenadas mundo corretas**: `readFloorArea` ja aplica o offset `camZ - nz` ao X/Y, entao tiles de outros andares tem posicao mundo correta
2. **`gs.tiles.clear()` no floor change**: impede residuos do andar anterior
3. **Viewport radius 40**: continua filtrando tiles distantes
4. **Range limitado**: so aceita andares que o protocolo realmente enviou (nao inventa dados)

### Resultado esperado

- Andares visitados pelo player: dados completos (como antes)
- Andares adjacentes nao visitados: dados parciais capturados automaticamente da perspectiva do protocolo
- Sem risco de contaminar andar X com tiles do andar Y (range visivel garante isso)

### Apos aplicar

Re-extrair os .cam problematicos e rodar "Generate Chunks" para popular os novos andares capturados.

