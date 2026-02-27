

## Corrigir Floor Bugado + Adicionar Botoes de Avanco/Retrocesso 10s

### Bug do Floor: Causa Raiz

Comparando com OTClient, o offset no `floorUp` para a transicao de surface (z=7) esta **invertido**.

**OTClient** usa `offset = 2 + nz` (formula `8 - 6 + i`):
- Floor 5: offset = 7
- Floor 0: offset = 2

**Codigo atual** usa `offset = 8 - nz`:
- Floor 5: offset = 3
- Floor 0: offset = 8

Isso causa tiles sendo posicionados em coordenadas erradas durante transicoes de andar, fazendo a camera "pular" para posicoes incorretas. O resultado e exatamente o que o usuario ve: floor indo pro lado errado e camera fora da posicao real.

### Correcoes

**Arquivo: `src/lib/tibiaRelic/packetParser.ts`**

1. **Corrigir offset no floorUp** (linha 531): Mudar `const offset = 8 - nz` para `const offset = 2 + nz` para alinhar com OTClient.

**Arquivo: `src/components/TibiarcPlayer.tsx`**

2. **Adicionar botoes de avanco/retrocesso 10 segundos**: Dois novos botoes na barra de controles:
   - Botao "voltar 10s" (icone SkipBack): chama `handleSeek` com `Math.max(0, progress - 10000)`
   - Botao "avancar 10s" (icone SkipForward): chama `handleSeek` com `Math.min(duration, progress + 10000)`
   - Posicionados ao lado dos controles de play/pause/reset
   - Importar icones `SkipBack` e `SkipForward` do lucide-react

### Detalhes Tecnicos

**Correcao do offset (packetParser.ts, floorUp method):**
```text
Antes:  const offset = 8 - nz;
Depois: const offset = 2 + nz;
```

**Novos botoes (TibiarcPlayer.tsx):**
- Funcao `seekRelative(deltaMs)` que reutiliza `handleSeek` com clamping em [0, duration]
- Botoes adicionados entre reset e speed na barra de controles
- Desabilitados quando nao ha gravacao carregada

