

## Análise dos Erros no Packet Dissector

### Frames com erro identificados

| Frame | Timestamp | Bytes Left | Último opcode | Contexto |
|-------|-----------|------------|---------------|----------|
| #6623 | 3563.53s  | 211        | FLOOR_UP (3B) | Z=8→7 (underground→surface) |
| #6625 | 3565.53s  | 480        | SCROLL_E (1B) | Após FLOOR_DOWN Z=7→8 |
| #6943 | 3606.44s  | 290        | SCROLL_E (200B) | Scroll com dados incompletos |
| #6953 | 3607.58s  | 292        | SCROLL_E (207B) | Scroll com dados incompletos |

### Causa raiz: FLOOR_UP de Z=8 para Z=7 lê poucos andares

O bug principal está no handler `floorUp` quando a câmera transita de **underground (Z=8) para surface (Z=7)**.

**O que o parser faz hoje:**
```typescript
if (g.camZ === 7) {
  const newFloor = Math.max(g.camZ - 2, 0); // = 5
  this.readFloorArea(r, ..., newFloor, 18, 14, offset, 0);
  // Lê APENAS 1 andar (z=5)
}
```

**O que o protocolo Tibia envia:** Ao sair do subsolo para a superfície, o servidor envia dados de **6 andares novos** (z=5, z=4, z=3, z=2, z=1, z=0) com skip encoding compartilhado. A referência do OTClient confirma:

```text
// OTClient reference:
for(int i = 5; i >= 0; i--)
    setFloorDescription(msg, ..., i, ..., 8 - i, &skip);
```

O parser só lê z=5, deixando os dados de z=4 até z=0 (centenas de bytes) como lixo no buffer. Isso corrompe o estado e causa erros em cascata nos SCROLL subsequentes.

### Frame #6623 em detalhe (prova)

```text
hex do FLOOR_UP: be ff ff
```
- `be` = opcode FLOOR_UP
- `ff ff` = skip marker (andar z=5 todo vazio)
- Mas faltam os dados dos andares z=4, z=3, z=2, z=1, z=0 → **211 bytes não consumidos**

### Efeito cascata nos outros frames

Os frames #6625, #6943 e #6953 têm SCROLL_E com bytes restantes. Isso ocorre porque:
1. A câmera está em posição inconsistente após um FLOOR_UP malformado
2. O `getFloorRange()` calcula ranges de andares errados para o estado corrupto
3. O SCROLL lê menos dados que o servidor enviou

### Plano de correção

**1. Corrigir `floorUp` em `packetParser.ts` (~linha 958)**

Quando `g.camZ === 7` (transitando para superfície), ler todos os 6 andares novos em loop com skip compartilhado, similar ao OTClient:

```typescript
if (g.camZ === 7) {
  let skip = 0;
  for (let nz = 5; nz >= 0; nz--) {
    const offset = 8 - nz;
    skip = this.readFloorArea(r, g.camX - 8, g.camY - 6, nz, 18, 14, offset, skip);
  }
}
```

**2. Adicionar logging de diagnóstico no floorUp**

Registrar quantos andares foram lidos e bytes consumidos para facilitar validação futura.

**3. Não alterar o floorDown nem o scroll**

O `floorDown` de Z=7→8 já lê 3 andares (z=8,9,10) corretamente. Os erros de SCROLL devem desaparecer quando o FLOOR_UP parar de corromper o estado.

### Resultado esperado

- Frame #6623: FLOOR_UP consome ~200+ bytes (6 andares com skip encoding) em vez de 3 bytes
- Frames #6625, #6943, #6953: erros de cascata eliminados pois o estado da câmera estará correto
- Redução significativa de "tela fora do lugar" nos momentos de transição superfície/subsolo

