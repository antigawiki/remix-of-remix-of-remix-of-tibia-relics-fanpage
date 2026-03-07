

## Plano: Recovery Per-Opcode no Parser C++ (Opção B)

### Problema Central
`Parser::Parse()` do tibiarc acumula eventos num vetor. Se qualquer opcode no frame lança exceção, o `catch` em `web_player.cpp` descarta **todos** os eventos do frame — incluindo map updates e movements válidos já parseados.

### Mudanças

**1. `tibiarc-player/protocol_patch.py`** — Duas novas funções:

- **`patch_parse_loop_recovery()`**: Encontra o while-loop principal do `Parser::Parse()` e envolve o corpo do switch em `try-catch` per-iteração. No `catch`, faz `break` do loop mas **preserva os eventos já acumulados** no vetor. Também muda o `default:` case para `break` em vez de `throw` (opcode desconhecido termina o frame sem destruir eventos).

```cpp
// Antes (tibiarc original):
while (reader.Remaining() > 0) {
    switch (reader.ReadU8()) {
        case 0x64: ... break;
        default: throw; // ← mata tudo
    }
}

// Depois (com patch):
while (reader.Remaining() > 0) {
    try {
        switch (reader.ReadU8()) {
            case 0x64: ... break;
            default: break; // ← para sem destruir
        }
    } catch (...) {
        break; // ← preserva eventos já parseados
    }
}
```

- **Remover `patch_diagnostic_logging()`**: Os `printf("[DIAG] opcode=...")` por opcode geram milhões de linhas e matam performance. Serão removidos da lista de patches e o patch existente será revertido se presente.

**2. `.github/workflows/build-tibiarc.yml`** — Atualizar verificação:
- Adicionar grep para confirmar presença do try-catch recovery
- Remover grep do diagnostic logging

**3. `.lovable/plan.md`** — Atualizar status dos patches.

### Por que isso resolve
Com recovery per-opcode, mesmo que 1 de 10 opcodes em um frame falhe, os outros 9 (map updates, creature moves, tile changes) são preservados e aplicados ao GameState. Os tiles param de "brigar" porque as atualizações de mapa não são mais descartadas em massa.

