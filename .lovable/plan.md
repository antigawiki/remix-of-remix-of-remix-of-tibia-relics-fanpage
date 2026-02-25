

# Fix: Sprites errados e camera presa no mesmo floor

## Causa raiz (confirmada via OTClient source code)

Comparei nosso `packetParser.ts` com o `protocolgameparse.cpp` do OTClient e encontrei **3 bugs criticos**:

### Bug 1: floorUp tem um `else` que le dados inexistentes (CRITICO)

Nosso codigo tem um caso `else` para `camZ < 7` (acima do solo indo mais alto) que tenta ler 18x14 tiles de dados que **nao existem no stream**:

```text
// NOSSO CODIGO (ERRADO):
} else {
    // Above ground going higher: read top visible floor
    const nz = Math.max(0, g.camZ - 2);
    this.readFloorAreaWithOffset(r, ..., nz, 18, 14, offset);
}
```

No OTClient, esse caso simplesmente **nao existe**. Quando o player muda de z=7 para z=6 (ou z=6 para z=5), todos os andares de superficie (0-7) ja estao carregados. O servidor nao envia dados novos. Nosso codigo le 252+ bytes de lixo, destruindo o parse de TODOS os pacotes subsequentes.

### Bug 2: Offsets de floor change errados por 1

Comparacao exata com OTClient:

**floorUp (0xBE) - crossing to surface (camZ == 7):**
```text
OTClient: offset = 8 - nz  (floor 5: offset=3, floor 4: offset=4, ...)
Nosso:    offset = 7 - nz  (floor 5: offset=2, floor 4: offset=3, ...)  ERRADO
```

**floorUp - underground going up (camZ > 7):**
```text
OTClient: offset = 3
Nosso:    offset = 2  ERRADO
```

**floorDown (0xBF) - crossing to underground (camZ == 8):**
```text
OTClient: j = -1, -2, -3  (floor 8: -1, floor 9: -2, floor 10: -3)
Nosso:    offset = 0, -1, -2  ERRADO
```

**floorDown - underground going deeper:**
```text
OTClient: offset = -3
Nosso:    offset = -2  ERRADO
```

### Bug 3: Tinting de outfit usa composite operation no canvas principal

`drawTintedLayer` usa `source-atop` no canvas principal, o que afeta TODOS os pixels ja desenhados, nao apenas o sprite da criatura. Isso causa artefatos visuais.

## Correcoes (arquivo por arquivo)

### A. `src/lib/tibiaRelic/packetParser.ts`

**floorUp** - Reescrever seguindo OTClient exatamente:
- Caso `camZ == 7`: loop de nz=5 ate 0, offset = `8 - nz`, skip compartilhado
- Caso `camZ > 7`: le floor `camZ - 2` com offset fixo `3`
- **Remover o caso `else`** (camZ < 7 nao envia dados no protocolo)
- Manter `camX++; camY++` no final

**floorDown** - Reescrever seguindo OTClient exatamente:
- Caso `camZ == 8`: loop com j comecando em `-1` decrementando
- Caso `camZ > 8 && camZ < 14`: le floor `camZ + 2` com offset fixo `-3`
- Sem caso else para transicoes de superficie
- Manter `camX--; camY--` no final

### B. `src/lib/tibiaRelic/renderer.ts`

**drawTintedLayer** - Corrigir composite:
- Trocar `source-atop` por `source-over` no canvas principal
- O canvas `cached` ja tem os pixels tintados corretamente, entao basta desenhar normalmente por cima

## Impacto esperado

- Bug 1 (else espurio) era a causa principal de desync massivo apos qualquer mudanca de andar acima do solo. Sem ele, o parser nao consumira bytes errados e os outfits/tiles subsequentes serao lidos corretamente.
- Bug 2 (offsets) fazia tiles serem armazenados 1 posicao errada apos mudancas de andar, mostrando terreno do andar errado.
- Bug 3 (composite) causava artefatos visuais menores no tinting de outfit.

