

# Plano: Correção de Drift — 0xA8 e DAT Flags

## Diagnóstico do Drift Scan (1980 frames com erro)

Identifiquei **3 problemas** analisando o log byte a byte:

### 1. **0xA8 (CreatureSquare): 1 byte, NÃO 5**
**Prova definitiva** — Frame #5802 (53 bytes):
```text
8c [CR_HEALTH 5B] a8 03 83 [EFFECT 7B] 84 [ANIM_TEXT 11B] 6a [ADD_THING 9B] 8c [CR_HEALTH 6B] 85 [PROJECTILE 12B]
= 6+2+7+11+9+6+12 = 53 bytes ← PERFEITO com a8=1B
```
O parser atual faz `r.skip(5)` — consome 4 bytes a mais por ocorrência. Confirmado em múltiplos frames (25865, 25880, etc).

**Correção JS** (`packetParser.ts` linha 402):
`r.skip(5)` → `r.u8()`

**Correção WASM** (`build-tibiarc.yml` linha 59):
`reader.Skip(5)` → `reader.Skip(1)`

### 2. **0x16: opcode não registrado**
Aparece no frame #0 (login). Provavelmente um opcode sem payload do TibiaRelic. Precisa ser adicionado ao dispatcher.

**Correção JS**: adicionar `else if (t === 0x16) { /* world enter marker */ }` no dispatcher.

### 3. **DAT: items stackable não reconhecidos**
Items como 0x0b3a (2874 = arrows) e 0x0dfe (3582) claramente enviam byte extra de count nos containers, mas o DAT não os marca como stackable. Isso indica que **ainda existe drift residual no parser de flags do DAT** (além do 0x07 já corrigido).

A prova: Frame #452 tem 20 itens 0x0b3a com byte 0x07 após cada um. Com stackable: 20×3=60 bytes → bate exatamente com o frame de 77B. Sem stackable: impossível.

**Ação**: após aplicar fix 1 e 2, re-rodar o DAT validator/analyzer para encontrar qual OUTRA flag tem payload errado. Provavelmente mais uma flag boolean que deveria ter u16.

## Arquivos a Editar

### `src/lib/tibiaRelic/packetParser.ts`
- Linha 402: `r.skip(5)` → `r.u8()` para 0xa8
- Adicionar `else if (t === 0x16) { }` no dispatcher (após linha 315)

### `.github/workflows/build-tibiarc.yml`
- Linha 59: `reader.Skip(5)` → `reader.Skip(1)` para 0xA8
- Atualizar comentário de "5B" para "1B"

## Próximos Passos (após implementar)
1. Re-rodar o Drift Scan para ver quantos erros restam
2. Verificar console do DatLoader para parse errors/verify failures
3. Se items continuarem sem stackable flag, investigar mais flags DAT no analyzer

