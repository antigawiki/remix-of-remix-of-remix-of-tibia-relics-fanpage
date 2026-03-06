

# Plano: Correção Definitiva — Flag 0x07 e Verificação FloorUp

## Diagnóstico

### 1. Flag 0x07 (ForceUse) — CAUSA RAIZ dos sprites errados
O analyzer provou que **Hipótese A (0x07=u16) é a única com Refs 3/3**. Tanto o `datLoader.ts` (JS) quanto o `dat_patch.py` (WASM) tratam 0x07 como boolean (0 bytes), quando deveria consumir 2 bytes. Isso causa drift silencioso em todos os items após o primeiro 0x07.

**Correção necessária em 2 arquivos:**

- `src/lib/tibiaRelic/datLoader.ts` linha 46: `0x07: 0` → `0x07: 2`
- `tibiarc-player/dat_patch.py` linha ~132: adicionar `reader.SkipU16();` no case `ForceUse`

### 2. FloorUp (0xBE) — JS já está correto, WASM já tem patch
Verifiquei o código:
- **JS** (`packetParser.ts` linhas 817-827): já lê 3 andares no z=7 (loop `nz = camZ-2` até `camZ`). **Correto.**
- **WASM** (`floorup_patch.py`): já injeta loop de 3 andares. **Correto.**

O Claude externo provavelmente analisou uma versão anterior do código. Ambos os players já têm a correção simétrica de floorUp.

## Mudanças

### Arquivo 1: `src/lib/tibiaRelic/datLoader.ts`
- Linha 46: `0x07: 0` → `0x07: 2`
- Atualizar comentário para refletir que ForceUse tem payload u16

### Arquivo 2: `tibiarc-player/dat_patch.py`
- No case `TypeProperty::ForceUse`: adicionar `reader.SkipU16();` antes do `break;`
- Isso garante que o WASM consome os mesmos 2 bytes extras

### Arquivo 3: `src/lib/tibiaRelic/datValidator.ts`
- Atualizar `baselineFlagPayloads()` para incluir `0x07: 2` como valor padrão (já que foi provado pelo analyzer)
- A Hipótese A deixa de ser necessária como teste separado (passa a ser o baseline)

São **3 edições cirúrgicas** — uma linha em cada arquivo. Nenhum risco de quebrar o build.

