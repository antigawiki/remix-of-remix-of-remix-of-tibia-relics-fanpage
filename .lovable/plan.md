

## Portar fix de duas fases do DAT parser para o WASM C++

O patch atual no C++ (linhas 107-119 do workflow) tenta tratar flags desconhecidas com try-catch individual, mas continua vulnerável a drift se alguma flag conhecida tiver tamanho de parâmetro errado. A mesma lógica de duas fases que corrigiu o JS precisa ser aplicada ao C++.

### Mudança: `.github/workflows/build-tibiarc.yml`

Substituir o patch atual do DAT parser (seção "DAT PARSER: RESILIENT TO UNKNOWN FLAGS") por um patch equivalente à lógica de duas fases:

**Fase 1 (C++):** No `ReadProperties`, salvar a posição inicial, avançar byte a byte até encontrar `0xFF` (o terminador de propriedades). Isso garante que o ponteiro fique alinhado para ler dimensões e sprites.

**Fase 2 (C++):** Voltar à posição salva e fazer a extração best-effort das propriedades (ground, blocking, etc.) em um bloco try-catch. Qualquer erro não afeta o ponteiro principal.

O sed patch vai:
1. Substituir todo o corpo do loop em `ReadProperties` para primeiro fazer scan até 0xFF
2. Depois chamar a lógica original de extração em try-catch sobre o range salvo
3. Garantir que o `reader` termina na posição correta (logo após 0xFF)

```cpp
// Conceito do patch C++:
void EntityType::ReadProperties(DataReader &reader, ...) {
    // Phase 1: find 0xFF terminator
    auto savedPos = reader.Position();
    while (reader.Remaining() > 0) {
        if (reader.ReadU8() == 0xFF) break;
    }
    auto endPos = reader.Position();
    
    // Phase 2: best-effort metadata from [savedPos, endPos-1)
    reader.Seek(savedPos);
    try {
        // original property-reading loop, but bounded to endPos-1
        while (reader.Position() < endPos - 1) {
            // ... original switch logic ...
        }
    } catch (...) {
        // ignore metadata errors
    }
    
    // Guarantee alignment
    reader.Seek(endPos);
}
```

O patch sed concreto vai injetar este padrão no `ReadProperties` de `lib/types.cpp`, substituindo o patch anterior que só tratava flags 0x50/0xC8/0xD0.

### Arquivos alterados
- `.github/workflows/build-tibiarc.yml` --- substituir seção "DAT PARSER: RESILIENT TO UNKNOWN FLAGS" pelo patch de duas fases

