

## Diagnostico e Correcao: Floor Mismatch e Criaturas Invisíveis

### Causa Raiz Identificada

Apos analise detalhada comparando com OTClient e tibiarc, identifiquei **dois bugs concretos**:

### BUG 1 - CRITICO: `floorChanged` nunca dispara (cleanup de criaturas nao executa)

Em `syncPlayerToCamera()`, a deteccao de mudanca de floor e:
```text
const floorChanged = player.z !== g.camZ;
```

Porem, durante `floorUp`/`floorDown`, o `readTileItems` ja atualiza `player.z` para o novo floor ANTES de `syncPlayerToCamera` rodar. Resultado: `player.z === g.camZ` e `floorChanged = false`. O codigo de limpeza de criaturas distantes **nunca executa**, deixando criaturas "fantasma" de floors anteriores no estado.

**Correcao**: Passar o `oldZ` explicitamente para `syncPlayerToCamera` a partir dos handlers `floorUp`/`floorDown`, em vez de tentar detectar automaticamente.

### BUG 2 - ALTO: HUD renderiza nomes em area maior que Pass 3 renderiza sprites

O HUD usa viewport `tx >= -2 && tx <= VP_W + 3` (20 colunas), mas Pass 3 (sprites) itera `tx = -1 a VP_W + 2` (18 colunas). Criaturas nas bordas tem nome sem sprite.

**Correcao**: Alinhar os bounds do HUD com os bounds do Pass 3.

### Plano de Implementacao

**Arquivo: `src/lib/tibiaRelic/packetParser.ts`**

1. Modificar `syncPlayerToCamera` para aceitar um parametro opcional `oldZ`:
   - `syncPlayerToCamera(oldZ?: number)`
   - Usar `oldZ !== undefined ? oldZ !== g.camZ : player.z !== g.camZ` para `floorChanged`

2. Nos handlers `floorUp` e `floorDown`, passar `oldZ` para `syncPlayerToCamera`:
   - `floorUp`: `this.syncPlayerToCamera(oldZ)` onde `oldZ` e o camZ antes do decremento
   - `floorDown`: `this.syncPlayerToCamera(oldZ)` onde `oldZ` e o camZ antes do incremento

3. Tambem passar `oldZ` nos handlers `mapDesc` (0x64) e player position (0x9a) que chamam `syncPlayerToCamera`, passando o camZ anterior ao update.

**Arquivo: `src/lib/tibiaRelic/renderer.ts`**

4. Alinhar o viewport do HUD com o Pass 3:
   - Mudar `tx2 >= -2 && tx2 <= VP_W + 3 && ty2 >= -2 && ty2 <= VP_H + 3`
   - Para `tx2 >= -1 && tx2 <= VP_W + 2 && ty2 >= -1 && ty2 <= VP_H + 2`

5. Adicionar log temporario nos floor changes para diagnostico futuro:
   - Console.log em `floorUp`/`floorDown` com oldZ, newZ, e contagem de criaturas limpas

### Resultado Esperado

- Criaturas de floors distantes sao corretamente removidas durante transicoes
- Nomes e sprites sempre aparecem juntos (mesma area de viewport)
- Logs de diagnostico permitem identificar problemas residuais rapidamente

