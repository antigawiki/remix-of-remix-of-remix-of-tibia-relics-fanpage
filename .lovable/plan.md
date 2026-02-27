

## Corrigir Player Sumindo e Criaturas Duplicadas

### Causa Raiz Identificada

O problema esta no metodo `readTileItems` (linhas 647-681 do packetParser.ts). Quando o mapa e lido (via `mapDesc`, `scroll`, ou `tileUpd`), este metodo reconstroi os tiles a partir dos dados do protocolo. Ele encontra criaturas (CR_FULL, CR_KNOWN, CR_OLD) e as adiciona ao tile novo, mas **nunca remove a criatura do tile antigo**.

**Duplicacao**: Criatura estava no tile A. Mapa e relido e o protocolo coloca a mesma criatura no tile B. `readTileItems` adiciona ao tile B mas nao remove do tile A. Resultado: criatura aparece em ambos os tiles.

**Desaparecimento**: Durante `scroll`, novos tiles sao lidos mas tiles antigos que ficam fora da area de leitura mantem referencias obsoletas. Quando o tile onde o player estava e sobrescrito sem incluir o player (porque o player ja moveu), o player perde sua referencia no tile. O safety net no renderer corrige parcialmente, mas com atraso de 1 frame e forcando posicao na camera (que pode estar errada durante transicoes).

Alem disso, quando tiles sao setados como vazios durante o skip (`setTile(x, y, z, [])` nas linhas 689, 703, 719), se uma criatura estava naquele tile, sua referencia e apagada silenciosamente.

### Correcoes

**Arquivo: `src/lib/tibiaRelic/packetParser.ts`**

1. **Deduplicar criaturas em `readTileItems`**: Antes de adicionar `['cr', cid]` ao tile novo, chamar `removeCreatureFromTile(cid, oldX, oldY, oldZ)` usando a posicao armazenada na criatura (se diferente do tile atual). Isso garante que a criatura so exista em um tile por vez, eliminando duplicatas.

2. **Proteger tiles vazios (skip) contra perda de criaturas**: Antes de `setTile(x, y, z, [])` nos loops de skip, verificar se o tile atual tem criaturas. Se tiver, preserva-las em vez de apagar. Isso evita que criaturas sumam quando seus tiles sao "skipados" durante leitura de mapa.

3. **Melhorar o safety net no renderer**: Em vez de forcar o player para `(camX, camY, camZ)` — que pode estar incorreto durante transicoes — buscar o player na posicao armazenada dele (`player.x, player.y, player.z`) e reinseri-lo la.

**Arquivo: `src/lib/tibiaRelic/renderer.ts`**

4. **Safety net mais preciso**: Ajustar para reinserir o player no tile da sua posicao armazenada (`player.x, player.y, player.z`) em vez de na posicao da camera. Isso e mais correto porque a camera pode estar 1 tile a frente durante scroll.

### Detalhes Tecnicos

**readTileItems corrigido (pseudo-codigo):**
```text
// Para CR_FULL, CR_KNOWN:
const c = readCreatureFull/Known(r);
// Remove do tile antigo ANTES de adicionar ao novo
if (c.x !== x || c.y !== y || c.z !== z) {
  removeCreatureFromTile(c.id, c.x, c.y, c.z);
}
c.x = x; c.y = y; c.z = z;
items.push(['cr', c.id]);

// Para CR_OLD:
const cid = r.u32(); const dir = r.u8();
const c = creatures.get(cid);
if (c) {
  if (c.x !== x || c.y !== y || c.z !== z) {
    removeCreatureFromTile(cid, c.x, c.y, c.z);
  }
  c.direction = dir; c.x = x; c.y = y; c.z = z;
}
items.push(['cr', cid]);
```

**Protecao de skip tiles:**
```text
// Em vez de: this.gs.setTile(x, y, z, []);
// Fazer: preservar criaturas existentes no tile
const existing = this.gs.tiles.get(key);
if (existing) {
  const creatures = existing.filter(i => i[0] === 'cr');
  this.gs.setTile(x, y, z, creatures);
} else {
  this.gs.setTile(x, y, z, []);
}
```

**Safety net corrigido:**
```text
if (player && !isOnTile) {
  // Reinserir no tile da posicao do player, nao da camera
  const tile = g.getTile(player.x, player.y, player.z);
  tile.push(['cr', player.id]);
  g.setTile(player.x, player.y, player.z, tile);
}
```

### Resultado Esperado
- Criaturas nunca aparecem duplicadas (deduplicacao na leitura de tiles)
- Player nao desaparece durante scrolls e leituras de mapa
- Sem regressao nos fixes anteriores de floor e walk offset

