

## O patch C++ contradiz diretamente a nossa última mudança

O arquivo `fix-scroll-floor-range.patch` — que é o patch aplicado no player WASM C++ que **funciona** — mostra claramente que **todas as 4 direções de scroll usam 18x14 com origem (-8, -6)**, não 1x14 ou 18x1.

### Por que a mudança para 1x14/18x1 foi errada

O TibiaRelic usa **skip encoding** dentro do grid completo 18x14. Quando o servidor envia dados de scroll, ele envia skip markers que posicionam os tiles dentro do grid de 252 tiles. Se lemos com dimensão 1x14 (14 tiles), os skip counts são interpretados dentro de um grid de 14 posições — posicionando tiles em coordenadas erradas. Com 18x14 (252 tiles), os mesmos skip counts posicionam tiles corretamente.

O buffer exhaution guard (`if (r.left() < 2) return skip`) para a leitura naturalmente quando os dados acabam, então ler 18x14 é seguro mesmo quando o servidor envia menos dados que o viewport completo.

### Por que 1x14 "funciona" em bytesLeft=0

O debug log mostra bytesLeft=0 — bytes são consumidos corretamente. Mas os **tiles são armazenados em posições erradas** porque o skip encoding é interpretado num grid de dimensão errada.

### Correção

Reverter `scroll()` para usar **18x14 com origem (camX-8, camY-6)** para todas as 4 direções, exatamente como o patch C++.

### Mudança técnica

**`packetParser.ts` — método `scroll()` (linhas 521-526):**

Todas as 4 direções passam a usar:
```
this.readMultiFloorArea(r, g.camX - 8, g.camY - 6, 18, 14, g.camZ, startz, endz, zstep);
```

| Arquivo | Mudança |
|---------|---------|
| `packetParser.ts` | `scroll()`: reverter para 18x14 com origem (-8,-6) para todas as direções |

