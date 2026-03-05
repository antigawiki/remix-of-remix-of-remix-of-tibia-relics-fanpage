

## Problema: YAML do workflow quebrado por escaping complexo

O bloco Python inline (`python3 -c "..."`) nas linhas 115-146 e o `sed` multi-linha nas linhas 155-162 têm problemas de escaping que invalidam o YAML ou quebram o shell. Aspas, barras invertidas e triple-quotes dentro de strings shell double-quoted causam conflitos.

## Solução: Usar heredoc para o script Python

Substituir o `python3 -c "..."` por `python3 << 'PYEOF' ... PYEOF`, que elimina todos os problemas de escaping. E simplificar o `sed` de catch/alignment para um segundo bloco Python no mesmo heredoc.

### Mudança em `.github/workflows/build-tibiarc.yml`

Substituir linhas 114-165 (seção "DAT PARSER: TWO-PHASE RESILIENT PARSING" + sed de catch) por:

```yaml
          # Use heredoc to avoid shell escaping issues
          python3 << 'PYEOF'
import re

with open('lib/types.cpp', 'r') as f:
    src = f.read()

# Find ReadProperties function and inject two-phase logic
pattern = r'(void EntityType::ReadProperties\([^)]*\)\s*\{)(.*?)(^\})'
match = re.search(pattern, src, re.DOTALL | re.MULTILINE)
if match:
    original_body = match.group(2)
    replacement = match.group(1) + """
    /* TibiaRelic: Two-phase DAT parsing for resilience */
    auto _savedPos = reader.Position();
    while (reader.Remaining() > 0) {
        if (reader.ReadU8() == 0xFF) break;
    }
    auto _endPos = reader.Position();
    reader.Seek(_savedPos);
    try {
""" + original_body + """
    } catch (...) { /* TibiaRelic: ignore metadata errors */ }
    reader.Seek(_endPos);
    return;
}"""
    src = src[:match.start()] + replacement + src[match.end():]
    with open('lib/types.cpp', 'w') as f:
        f.write(src)
    print('Two-phase DAT patch applied successfully')
else:
    print('WARN: ReadProperties not found in types.cpp')
PYEOF
```

Isso:
1. Elimina todos os problemas de escaping (heredoc `'PYEOF'` = sem interpolacao)
2. Preserva o corpo original da funcao dentro do try-catch
3. Garante alinhamento com `reader.Seek(_endPos)` no final
4. Remove o `sed` separado de catch que era fragil

