

## Plano: Recalibrar o prompt da IA para análise neutra do protocolo

### Problema atual

O `PROTOCOL_SPEC` na edge function `analyze-cam-protocol` contém vieses incorretos:

1. **Linha 19-22**: Scroll opcodes documentados como "18x14 viewport" — errado, o protocolo real usa faixas (18x1 / 1x14)
2. **Linha 58**: OutfitWindow documentado como "u16 rangeStart + u16 rangeEnd" — errado, TibiaRelic usa u8+u8
3. **Linhas 60-64**: Seção "Known C++ Parser Divergences" assume que o C++ está errado e o JS está certo
4. **Linhas 66-70**: "Analysis Goal" pede para comparar com o JS "which works correctly" — falso, ambos estão quebrados
5. **System prompt (linha 84-95)**: Instrui a IA a focar em divergências entre JS e C++, quando o objetivo real é encontrar o protocolo correto independente de ambos

### Correções

**Arquivo: `supabase/functions/analyze-cam-protocol/index.ts`**

1. **Corrigir o PROTOCOL_SPEC**:
   - Scroll opcodes: documentar como faixas (18x1 / 1x14), não viewport inteiro
   - OutfitWindow: range u8+u8 (2 bytes total), não u16+u16
   - Remover a seção "Known C++ Parser Divergences" que enviesava a análise
   - Reescrever "Analysis Goal" para ser neutro: analisar os bytes brutos contra a spec do protocolo, sem assumir que nenhum parser está correto

2. **Reescrever o system prompt**:
   - Remover a premissa de que o JS está correto
   - Instruir a IA a analisar os bytes brutos do .cam contra a especificação do protocolo TibiaRelic
   - Quando encontrar divergências, apontar o que o protocolo exige vs o que os bytes mostram
   - Sugerir correções para ambos os parsers (JS e C++) quando aplicável
   - Focar em: validação de consumo de bytes por opcode, detecção de drift, e identificação de opcodes customizados não documentados

### Resultado esperado

A IA deixará de tratar o parser JS como referência e passará a analisar objetivamente os bytes brutos, identificando erros em ambos os parsers e propondo o comportamento correto baseado na especificação do protocolo.

