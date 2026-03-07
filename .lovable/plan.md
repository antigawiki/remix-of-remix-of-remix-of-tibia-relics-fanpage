

## Causa Raiz: DatLoader lendo bytes errados no flag Ground (0x00)

Comparei linha por linha o `DatReader.ts` do Cam Mapper com o `datLoader.ts` deste projeto. Ambos usam o **mesmo arquivo Tibia.dat**. O Cam Mapper funciona 100%. A diferença crítica:

### O bug

No `datLoader.ts`, o flag `0x00` (Ground) lê **3 bytes**:
```typescript
// NOSSO (ERRADO) — linha 250
if (flag === 0x00) {
  it.speed = view.getUint16(p, true); /* groundType = bytes[p+2] */ p += 3;
}
```

No Cam Mapper (`DatReader.ts`), o mesmo flag lê **2 bytes**:
```typescript
// CAM MAPPER (CORRETO)
case 0x00:
  item.groundSpeed = view.getUint16(pos, true); pos += 2;
```

### Por que isso corrompe o mapa

O byte extra no flag Ground desalinha a leitura de **todas as flags subsequentes** do mesmo item. Exemplo prático:

```text
Item com flags: [0x00(Ground), 0x05(Stackable), 0x0A(Fluid), 0xFF(End)]

Cam Mapper:  0x00 → lê 2 bytes → encontra 0x05 → marca isStackable ✓
Nosso:       0x00 → lê 3 bytes → pula 0x05 → lê byte errado como flag
```

Resultado: itens Ground+Stackable não são detectados como stackable. Quando o protocol parser encontra esse item no mapa, `readItemExtra()` **não lê o byte extra** que o servidor enviou → **-1 byte drift** → todo tile description subsequente fica corrompido → tiles aparecem em andares errados.

Nosso DatLoader usa "skip to 0xFF" como Phase 1, então as **fronteiras entre itens** estão corretas — mas os **metadados internos** (isStackable, isFluid, isSplash) ficam errados para qualquer item que tenha Ground como primeira flag (que é a maioria dos tiles de chão).

### Correção

**Arquivo: `src/lib/tibiaRelic/datLoader.ts`**

1. Mudar flag `0x00` de `p += 3` para `p += 2` (alinhar com Cam Mapper)

Essa é a única diferença de consumo de bytes entre os dois DatReaders. Todos os outros flags consomem o mesmo número de bytes.

### Sobre re-extração

Sim, após essa correção será necessário re-extrair todos os `.cam` files. Os dados atuais no banco foram extraídos com detecção errada de isStackable/isFluid/isSplash, o que causou byte drift durante o parsing e corrompeu coordenadas de tiles.

