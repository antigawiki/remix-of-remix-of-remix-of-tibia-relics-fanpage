

## Diagnóstico: Erros apenas no motor WASM (C++ tem 0 erros no JS)

O log do Packet Dissector mostra **24.045 frames com left=0** — zero erros no parser TypeScript. O problema é 100% no motor WASM, causado por patches `sed` que não aplicam corretamente no código C++.

### Bugs identificados nos patches sed

**1. Talk (0xAA) — statementGuid nunca lido**

O `sed` injeta `reader.SkipU32()` APÓS a linha `uint32_t messageId = reader.ReadU32()`, que está DENTRO do bloco `if (ReportMessages)`. Para 7.72, `ReportMessages=false` → o bloco não é executado → **4 bytes perdidos por cada mensagem de chat**. Drift acumulativo ao longo do replay.

```text
// O que o sed faz (ERRADO):
if (Version_.Protocol.ReportMessages) {
    uint32_t messageId = reader.ReadU32();
    /* TibiaRelic: unconditional u32 statementGuid */ reader.SkipU32(); // ← DENTRO DO IF!
}

// O que deveria fazer (CORRETO):
reader.SkipU32(); // ← ANTES do if, incondicional
if (Version_.Protocol.ReportMessages) {
    uint32_t messageId = reader.ReadU32();
}
```

**2. SpellGroupCooldown (0xA5) — compartilha handler com 0xA4**

O fork usa `case 0xA5` junto com `case 0xA4`, ambos chamando `ParseSpellCooldown`. O patch mudou SkipU32→SkipU8, fazendo 0xA5 ler 2B quando deveria ler 5B → **3 bytes perdidos por cooldown de grupo**.

**3. Fragilidade geral do sed**

Todos os patches dependem de formatação exata do source C++ e falham silenciosamente.

### Plano: Substituir todos os sed por um único script Python

Criar `tibiarc-player/protocol_patch.py` que aplica TODAS as correções de protocolo com regex preciso (mesma abordagem do `dat_patch.py` que já funciona):

1. **0xAA ParseCreatureSpeak**: Injetar `reader.SkipU32()` logo após o `{` de abertura da função (antes de qualquer condicional)
2. **0xA4 ParseSpellCooldown**: Manter o patch SkipU32→SkipU8 (2B correto para TibiaRelic)
3. **0xA5**: Separar do case 0xA4 — inserir case próprio com `reader.Skip(5)` 
4. **0xA7 PlayerTactics**: Remover linha PvPMode
5. **0xA8 CreatureSquare**: Adicionar case com `reader.Skip(5)`
6. **0xB6 WalkCancel**: Remover payload
7. **0x92 CreatureImpassable**: Remover assert

Atualizar `.github/workflows/build-tibiarc.yml` para substituir toda a seção de sed por:
```bash
python3 $GITHUB_WORKSPACE/tibiarc-player/protocol_patch.py lib/parser.cpp
```

### Arquivos a criar/editar

| Arquivo | Ação |
|---------|------|
| `tibiarc-player/protocol_patch.py` | Criar — script Python com todos os patches de protocolo |
| `.github/workflows/build-tibiarc.yml` | Editar — substituir sed por chamada ao script Python |

