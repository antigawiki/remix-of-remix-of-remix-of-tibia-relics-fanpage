
# Fix: Sprites de criaturas trocados no Cam Player

## Problema identificado

O DAT loader usa o metodo `readItem` para parsear TODAS as categorias (items, outfits, efeitos, distancia). Esse metodo le um campo extra `patZ` (byte adicional do TibiaRelic) para todas as entradas. Porem, e muito provavel que o campo `patZ` so exista para **items**, nao para outfits/efeitos/distancia.

Quando o parser le um byte `patZ` que nao existe para outfits:
1. O byte que deveria ser `anim` e lido como `patZ`
2. O primeiro byte do primeiro sprite ID e lido como `anim`
3. A contagem de sprites fica errada
4. A posicao de leitura desloca, e TODOS os outfits subsequentes sao lidos da posicao errada
5. Resultado: outfit do rotworm contem sprite IDs do tigre, outfit do elf NPC contem sprite IDs de outra criatura

Isso explica porque:
- **Corpos mortos** (items) renderizam corretamente: items tem patZ e sao parseados primeiro
- **Criaturas vivas** mostram sprites errados: outfits nao tem patZ mas o parser le um byte extra, causando drift cascateante

## Plano de implementacao

### 1. Separar leitura de dimensoes com/sem patZ no DatLoader

Modificar `datLoader.ts` para aceitar um parametro indicando se deve ler patZ:
- `readItem(bytes, view, p, hasPatZ)` - adicionar parametro booleano
- Items: `hasPatZ = true`
- Outfits, efeitos, distancia: `hasPatZ = false`

Quando `hasPatZ = false`, pular a leitura do byte patZ e usar patZ=1 como padrao.

### 2. Adicionar verificacao de outfits no DatLoader

Adicionar ao metodo `verify()` checagens para outfits conhecidos, similar ao que ja existe para items. Logar os primeiros sprite IDs de alguns outfits para validacao visual no console.

### 3. Remover fallback `resolveOutfit` do Renderer

O metodo `resolveOutfit` que busca outfits proximos (+-10 IDs) mascara o problema real e pode mapear para criaturas completamente erradas. Remover esse fallback - se um outfit nao tem sprites, mostrar o placeholder colorido em vez de uma criatura errada.

### 4. Adicionar log diagnostico temporario

Adicionar log no renderer para os primeiros creatures renderizados, mostrando: looktype, spriteIds do DAT, dimensoes do outfit. Isso confirma que o fix funcionou.

---

### Detalhes tecnicos

**datLoader.ts** - Mudanca principal:

```typescript
// No load(), passar hasPatZ para cada categoria:
for (let i = 0; i < nItems; i++) {
  const [it, np] = this.readItem(bytes, view, p, true);  // items TEM patZ
  ...
}
for (let i = 0; i < nOutfits; i++) {
  const [it, np] = this.readItem(bytes, view, p, false); // outfits NAO tem patZ
  ...
}
// fx e dist tambem sem patZ
```

```typescript
// Na leitura de dimensoes:
it.patY = Math.max(1, Math.min(bytes[p], 8)); p++;
if (hasPatZ) {
  it.patZ = Math.max(1, Math.min(bytes[p], 8)); p++;
} else {
  it.patZ = 1; // padrao
}
it.anim = Math.max(1, Math.min(bytes[p], 32)); p++;
```

**renderer.ts** - Remover resolveOutfit:

```typescript
// Voltar a usar lookup direto
const ot = this.dat.outfits.get(c.outfit);
// Em vez de: const ot = this.resolveOutfit(c.outfit);
```
