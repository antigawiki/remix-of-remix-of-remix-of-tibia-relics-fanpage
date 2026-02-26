

## Diagnosticar e Corrigir Sprites de Criaturas Cortados

### Problema
Algumas criaturas (Stone Golems) aparecem completas, mas outras (Deer, Jon, Aelane) aparecem cortadas/parciais. Monstros mortos (itens) renderizam corretamente, o problema e apenas nos vivos (outfits).

### Diagnostico
O padrao observado (2x2 corretos, 1x1 cortados) sugere uma de duas causas:

1. **Off-by-1 no item count** - Se `itemCount` esta errado por 1, todos os outfits ficam deslocados, mostrando sprites do looktype adjacente
2. **Byte extra `exact_size` para outfits** - Se TibiaRelic inclui `exact_size` mesmo para outfits 1x1, o parser nao le esse byte, desalinhando tudo para 1x1 mas nao para 2x2 (que ja leem o byte)
3. **`hasPatZ` incorreto para outfits** - Se outfits nao tem patZ no DAT, cada outfit le 1 byte a mais, corrompendo dims e sprites

### Plano de Implementacao

**1. Adicionar verificacao detalhada no DatLoader (datLoader.ts)**
- Expandir `verify()` com mais outfits conhecidos e dimensoes esperadas:
  - Looktype 1 (citizen): esperado 1x1, layers=2, patX=4, anim=2-3
  - Looktype 36 (rotworm): esperado 1x1, layers=1, patX=4, anim=2-3
  - Looktype 128 (player): esperado 1x1, layers=2, patX=4
  - Looktype ~67 (stone golem): esperado 2x2, layers=1, patX=4
- Logar dimensoes REAIS vs ESPERADAS para detectar shifts

**2. Adicionar log diagnostico no renderer (renderer.ts)**
- Nos primeiros 30 criaturas renderizadas, logar:
  - nome, looktype, dims do outfit no DAT, spriteIds[0..3]
  - Se dims nao batem com esperado (ex: deer com layers!=1 ou patX!=4), flaggar como suspeito

**3. Testar hipotese de `hasPatZ` para outfits (datLoader.ts)**
- Separar o parametro `hasPatZ` entre items e outfits
- Carregar outfits com `hasPatZ = false` como teste
- Se os sprites ficarem corretos, confirma a hipotese

**4. Testar hipotese de item count off-by-1 (datLoader.ts)**
- Adicionar log comparando: ler com `itemMaxId - 100 + 1` vs `itemMaxId - 100`
- Verificar se outfit 1 com count-1 tem sprites mais plausíveis

**5. Correcao baseada nos resultados**
- Aplicar o fix que resolver o desalinhamento (provavelmente patZ ou count)
- Validar que Stone Golems continuam corretos apos a mudanca

### Detalhe Tecnico

O ponto chave e que `readEntry` e compartilhado entre items e outfits:

```text
readEntry(bytes, view, p, hasPatZ=true)
  -> flags... 0xFF
  -> width, height
  -> [exact_size if w>1 or h>1]
  -> layers, patX, patY
  -> [patZ if hasPatZ]
  -> anim
  -> sprite IDs
```

Se `hasPatZ` estiver errado para outfits, cada outfit consome 1 byte a mais, e:
- patZ = valor real do anim
- anim = primeiro byte do primeiro sprite ID
- Sprites completamente errados

Isso explicaria por que 2x2 (stone golem) pode parecer correto por coincidencia (o byte extra alinha diferente com exact_size) enquanto 1x1 fica cortado.

### Arquivos a Modificar
- `src/lib/tibiaRelic/datLoader.ts` - Diagnosticos + fix de hasPatZ/count
- `src/lib/tibiaRelic/renderer.ts` - Log diagnostico de criaturas renderizadas

