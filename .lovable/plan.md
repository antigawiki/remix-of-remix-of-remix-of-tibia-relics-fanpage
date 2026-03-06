

## Plano: Criar Edge Function para Testes de Leitura de DAT/SPR com IA

### Contexto

O AI Byte Lab atual analisa apenas traces de protocolo (.cam). A hipótese é que o .dat e/ou .spr estão sendo lidos 98% correto, mas uma pequena diferença (ex: um flag com payload diferente, sprite ID u16 vs u32, contagem off-by-one) causa drift no `parseTileDescription` — porque `skipItem()` consome bytes baseado em `isStackable`/`isFluid`/`isSplash` lidos do .dat.

### O que será feito

**1. Nova Edge Function: `analyze-dat-spr`**

Uma edge function dedicada que recebe dumps do .dat e .spr e pede à IA para testar diferentes hipóteses de leitura:

- **Hipótese A**: Flag 0x07 tem payload (u16) em vez de ser boolean puro
- **Hipótese B**: Flag 0x08/0x09 tem payload de 4 bytes em vez de 2
- **Hipótese C**: Flags 0x1C/0x1D consomem 4 bytes em vez de 2
- **Hipótese D**: Existe flag intermediária entre 0x1E e 0x1F com payload
- **Hipótese E**: Range 0x1F-0x4F não é tudo boolean — alguns têm payloads
- **Hipótese F**: Sprite IDs no .dat são u32 em vez de u16

A IA receberá os bytes brutos de N items do .dat (hex dump) e tentará parsear cada item com cada hipótese, verificando se as dimensões e sprite IDs resultantes fazem sentido.

**2. Nova aba no AiByteLabTab: "DAT/SPR Tester"**

Adicionar um modo de operação ao AI Byte Lab existente que:
- Extrai os bytes brutos de um range de items do .dat carregado
- Envia para a edge function com as hipóteses
- Exibe os resultados comparativos (qual abordagem produz menos items com dimensões suspeitas, menos bytes restantes, sprite IDs válidos)

**3. Dados enviados para a IA**

Para cada item no range selecionado:
- Hex dump completo dos bytes (do início do entry até o final dos sprite IDs)
- Resultado do parse atual (flags lidas, dimensões, sprite count)
- Se `verify()` bateu ou falhou para items conhecidos

Incluir também:
- Signature do .dat
- Flag usage stats (quais flags aparecem e quantas vezes)
- Contagem de items com dimensões suspeitas
- Bytes restantes no final do arquivo

**4. System prompt da IA**

Instruir a IA a:
- Parsear os bytes brutos manualmente com cada hipótese
- Contar quantos items ficam com dimensões válidas (w/h 1-4, anim 1-8)
- Verificar se os sprite IDs resultantes estão no range válido do .spr
- Identificar qual hipótese produz o melhor alinhamento
- Sugerir a correção exata no código do `extractMetadata`

### Arquivos a criar/editar

- `supabase/functions/analyze-dat-spr/index.ts` — nova edge function
- `supabase/config.toml` — registrar a nova function (verify_jwt = false)
- `src/components/cam-analyzer/AiByteLabTab.tsx` — adicionar toggle DAT/SPR test mode e UI para enviar/receber análise

