

## Correção dos flags 32 (0x20), 33 (0x21) e 34 (0x22) no parser DAT

### Problema
A linha 254 trata flags `0x1F` até `0x4F` como booleanos sem payload. Isso está incorreto para:
- **Flag 0x20 (cloth)**: payload `u16` (2 bytes)
- **Flag 0x21 (market)**: payload `u16 + u16` (4 bytes)  
- **Flag 0x22 (usable)**: boolean (sem payload) — já está correto

### Alteração
**Arquivo:** `src/lib/tibiaRelic/datLoader.ts` (linhas 253-254)

Substituir o bloco genérico `0x1F-0x4F` por tratamento específico:

```typescript
else if (flag === 0x1E) { /* walkable */ }
else if (flag === 0x1F) { /* look — boolean */ }
else if (flag === 0x20) { /* cloth */ if (p + 1 < end) p += 2; else return; }
else if (flag === 0x21) { /* market */ if (p + 3 < end) p += 4; else return; }
else if (flag === 0x22) { /* usable — boolean */ }
else { /* unknown flag — skip, don't break */ }
```

Isso garante que os bytes de payload dessas flags sejam consumidos corretamente, evitando desalinhamento na leitura dos metadados.

