

## Corrigir Player Sumindo e Descentralizado

### Problemas Identificados

**1. Player some durante playback acelerado ou seek**
Quando multiplos pacotes de movimento sao processados em um unico frame de render (especialmente em 2x-8x ou apos seek), o `moveCr` pode falhar em encontrar a criatura correta no tile fonte. O fallback pega a PRIMEIRA criatura do tile (que pode nao ser o player), deixando o player "orfao" no tile antigo enquanto a camera (camX/camY) avanca via opcode `scroll`. Resultado: player fora do viewport = invisivel.

**2. Player descentralizado (viewport parece maior do que mostra)**
Durante playback acelerado, multiplos `moveCr` para o player acontecem entre dois renders. Cada um sobrescreve o `walkOffset` do anterior. A camera (camX/camY) pula N tiles, mas o walk offset so compensa 1 tile. Resultado: player aparece N-1 tiles deslocado do centro.

**3. Walk offsets residuais apos seek**
Apos seek, os pacotes sao reaplicados rapidamente. Walks ficam com `walkStartTick = performance.now()` do momento do seek, criando animacoes fantasma que deslocam a camera.

### Correcoes Planejadas

**Arquivo: `src/lib/tibiaRelic/packetParser.ts`**

1. **Identificacao precisa do player em moveCr**: Quando o stackpos nao bate no tile fonte, antes de pegar "qualquer criatura", verificar especificamente pelo ID armazenado na criatura (comparar `c.x/c.y/c.z` com a posicao fonte). Isso evita mover a criatura errada.

2. **Snap de walk anterior**: Quando `moveCr` chega para uma criatura que ja esta andando (`c.walking === true`), zerar o walk anterior antes de iniciar o novo. Isso evita acumulo de offsets incorretos.

3. **Modo de seek sem walk animation**: Adicionar flag `seekMode` ao parser. Quando ativo (durante seek/replay rapido), nao setar walk animation nas criaturas. Walks so devem animar durante playback em tempo real.

**Arquivo: `src/lib/tibiaRelic/renderer.ts`**

4. **Safety net do player**: No metodo `draw()`, apos computar o viewport, verificar se o player creature existe mas NAO esta em nenhum tile visivel. Se isso acontecer, forcar o re-posicionamento do player no tile `(camX, camY, camZ)`. Isso e um fallback defensivo para qualquer edge case de protocolo.

5. **Nao aplicar walk offset do player na camera quando walking=false**: Garantir que `camOffX/Y` so e computado quando o player realmente tem walk ativo, evitando offset residual.

**Arquivo: `src/components/TibiarcPlayer.tsx`**

6. **Limpar walks apos seek**: Apos `applyTo()` durante seek, iterar sobre todas as criaturas e setar `walking = false`, `walkOffsetX/Y = 0`. Isso elimina animacoes fantasma pos-seek.

7. **Passar flag de seek para o parser**: Setar `parser.seekMode = true` antes do replay rapido e `false` depois.

### Detalhes Tecnicos

**moveCr melhorado (pseudo-codigo):**
```
// Format A: tile-based
ft = getTile(fx, fy, fz)
// 1. Try exact stackpos
if ft[sp] is creature -> use it
// 2. Search by creature position match (NEW)
else -> for each creature in ft:
  c = creatures.get(cid)
  if c.x == fx && c.y == fy && c.z == fz -> use it
// 3. Last fallback: any creature on tile
else -> pick first creature
```

**Snap de walk anterior:**
```
if (c.walking) {
  c.walking = false;
  c.walkOffsetX = 0;
  c.walkOffsetY = 0;
}
// Then start new walk...
```

**Safety net no renderer:**
```
// After computing viewport, before drawing HUDs
if (playerId && player exists) {
  const playerTile = getTile(player.x, player.y, player.z);
  const isOnTile = playerTile.some(i => i[0]==='cr' && i[1]===playerId);
  if (!isOnTile) {
    // Force re-add player to camera position
    player.x = camX; player.y = camY; player.z = camZ;
    placeOnTile(player);
  }
}
```

### Resultado Esperado
- Player nunca desaparece (safety net + identificacao precisa)
- Player fica centralizado mesmo em 4x/8x (sem acumulo de walk offsets)
- Seek limpo sem animacoes residuais
- Sem regressao no z-order fix anterior

