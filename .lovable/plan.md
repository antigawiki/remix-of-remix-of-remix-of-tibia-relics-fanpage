

## Análise: Por que os patches não resolveram

### O que os logs mostram

Os logs de diagnóstico confirmam que o **frame 1 é parseado corretamente**:
- `0xA0` (PlayerStats) consumiu 20 bytes ✅ (patch do stamina funcionou)
- `0xA1` (PlayerSkills) consumiu 14 bytes ✅
- `0xD2` (VIP) com tamanhos variáveis ✅
- `0x6D` (MoveCr) no final do frame ✅
- Frame 2 começa com `0xAC` rem=14 ✅

O parsing inicial está correto. Os erros visuais ocorrem **em frames posteriores** que não aparecem no console (o log só mostra os primeiros frames).

### O problema real

Os patches `sed` foram aplicados "às cegas" — sem ver o código C++ real do `lib/parser.cpp`. Os patterns de sed podem:
1. **Não encontrar o match** (funções com formatação diferente do esperado)
2. **Injetar no lugar errado** (ex: `SkipU32` no `ParseTalk` pode estar antes ou depois da leitura do tipo de mensagem, quando deveria estar antes do nome)
3. **Não cobrir todos os opcodes divergentes** — podem existir dezenas de opcodes com payloads diferentes que só aparecem em frames tardios

### Plano: Diagnóstico direcionado + Abordagem alternativa

**Fase 1 — Capturar o ponto exato de falha**

Adicionar logging estendido no `web_player.cpp` que mostre **qual frame causa a primeira exceção/crash**:
- No loop de parse em `load_recording_tibiarelic`, logar `frameCount` e `sz` de cada frame que lança exceção
- Contar quantos frames são parseados com sucesso vs falha
- Logar o primeiro opcode que causa exceção

Isso nos diz se o problema é em 5% dos frames ou 95%.

**Fase 2 — Hex dump do frame problemático**

No `web_player.cpp`, quando um frame falha no parse, fazer hex dump dos primeiros 32 bytes para o console. Assim podemos ver exatamente quais opcodes estão causando problema e cruzar com a referência JS.

**Fase 3 — Skip de frames com erro em vez de abortar silenciosamente**

Atualmente o `catch(...)` no loop de frames silencia tudo. Mudamos para logar e continuar, assim a reprodução não para mas sabemos onde estão os problemas.

### Mudanças concretas

1. **`tibiarc-player/web_player.cpp`** — Adicionar contadores e logging no loop de parse:
   - `printf("[tibiarc] Frame %d: %d bytes, opcodes parsed OK\n", ...)` para frames bons
   - `printf("[tibiarc] Frame %d FAILED: %d bytes, hex=%02X%02X%02X...\n", ...)` para frames ruins
   - Limitar output a primeiras 50 falhas para não floodar

2. **`.github/workflows/build-tibiarc.yml`** — Sem mudanças nos patches sed (já estão aplicados), mas adicionar verificação pós-build que mostra quais patches foram efetivamente encontrados no código

Isso nos dará dados concretos para identificar os opcodes que ainda causam drift, em vez de adivinhar.

