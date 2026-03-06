

## Análise: Parser DAT vs Especificação 7.72

O GPT forneceu a tabela correta de opcodes do `.dat` para Tibia 7.72. Comparando com nosso parser atual, existem **vários bugs de payload** que causam drift nos metadados. Porém, o problema principal é mais fundamental.

### Problema raiz: Blind scan para 0xFF

Nosso parser usa uma abordagem de "duas fases":
1. **Phase 1**: Escaneia byte a byte até encontrar `0xFF` (terminador)
2. **Phase 2**: Tenta extrair metadados dos bytes já escaneados

O problema: se qualquer payload contém o byte `0xFF` (ex: flag `0x16` light com `intensity=0xFF00` armazenado little-endian como `[0x00, 0xFF]`), o scanner para prematuramente. Isso desalinha a leitura de dimensões e sprites de **todos os itens subsequentes**.

### Bugs específicos de payload (nosso parser vs spec 7.72)

```text
Flag   Spec 7.72              Nosso parser         Erro
─────  ─────────────────────  ──────────────────  ─────────────
0x15   rotatable (0 bytes)    4 bytes lidos        +4B extras
0x16   light (4 bytes)        0 bytes (flag)       -4B faltando
0x18   translucent (0 bytes)  4 bytes (displace)   +4B extras
0x19   displacement (4B x+y)  2 bytes (u16)        -2B faltando
0x1A   elevation (2 bytes)    0 bytes (flag)       -2B faltando
0x1E   lensHelp (2 bytes)     0 bytes (flag)       -2B faltando
0x1F+  vários com payload     todos como flag(0B)  vários
```

Nota: Flags como `0x21` (cloth), `0x22` (market), `0x23` (defaultAction) provavelmente não existem no `.dat` 7.72 do TibiaRelic, então não são prioritárias.

### Plano

#### 1. Reescrever `extractMetadata` com payloads corretos da spec 7.72
**Arquivo:** `src/lib/tibiaRelic/datLoader.ts` — método `extractMetadata`

Corrigir a tabela de flags:
- `0x15`: rotatable → 0 bytes (remover leitura de 4 bytes)
- `0x16`: light → ler `u16 intensity + u16 color` (4 bytes)
- `0x17`: dontHide → 0 bytes (flag)
- `0x18`: translucent → 0 bytes (remover leitura de 4 bytes)
- `0x19`: displacement → ler `u16 x + u16 y` (4 bytes, não 2)
- `0x1A`: elevation → ler `u16` (2 bytes, não flag)
- `0x1B`: lyingCorpse → 0 bytes
- `0x1C`: animateAlways → 0 bytes (remover leitura de 2 bytes)
- `0x1D`: minimapColor → `u16` (2 bytes) — já correto
- `0x1E`: lensHelp → `u16` (2 bytes)
- `0x1F`: fullGround → 0 bytes
- `0x20`: look → 0 bytes
- `0x21`: cloth → `u16` (2 bytes)
- `0x22`: market → `u16 + u16` (4 bytes, se existir)
- `0x23`: defaultAction → `u8` (1 byte)
- `0x24`-`0x28`: flags (0 bytes)

#### 2. Substituir blind scan por parser inteligente no `readEntry`
**Arquivo:** `src/lib/tibiaRelic/datLoader.ts` — método `readEntry`

Em vez do "Phase 1 blind scan", usar o `extractMetadata` corrigido como o parser principal. Se encontrar uma flag desconhecida, aí sim fazer scan forward para o próximo `0xFF` como fallback de recuperação. Isso garante que payloads contendo `0xFF` não quebrem o alinhamento.

#### 3. Manter a verificação de referência
A função `verify()` com itens conhecidos (102, 408, 870) continua como validação — se os sprites baterem, o parser está alinhado.

