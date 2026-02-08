

# Plano: Otimização de Performance do XP Tracker Web

## Diagnóstico do Problema

O XP Tracker atual está lento porque:

1. **Captura da tela inteira** - Processa toda a janela do jogo (ex: 1920x1080 pixels)
2. **OCR em imagem grande** - Tesseract.js analisa milhões de pixels para encontrar apenas uma palavra
3. **Processamento frequente** - A cada 3 segundos faz todo esse trabalho pesado
4. **Pré-processamento pixel a pixel** - Loop por cada pixel da imagem para melhorar contraste

## Solução: Região de Interesse (ROI)

A melhor alternativa é permitir que o usuário **selecione apenas a área do XP** na tela. Isso reduz drasticamente o trabalho:

| Cenário | Tamanho | Pixels processados |
|---------|---------|-------------------|
| Tela inteira | 1920x1080 | ~2.073.600 |
| **Região do XP** | ~200x30 | **~6.000** |
| **Redução** | -- | **~99.7% menos** |

## Funcionalidades a Implementar

### 1. Seletor de Região Visual
- Após capturar a tela, exibir uma prévia onde o usuário pode desenhar um retângulo
- Arrastar e soltar para definir a área que contém o XP
- Botão para confirmar a seleção

### 2. Captura Apenas da Região
- Ao processar cada frame, recortar apenas a região selecionada
- Passar imagem muito menor para o OCR

### 3. Intervalo Adaptativo
- Aumentar intervalo para 5 segundos (reduz 40% das chamadas)
- Opção para ajustar: "Performance" (10s) vs "Precisão" (3s)

### 4. Persistência da Região
- Salvar a região selecionada no localStorage
- Reutilizar nas próximas sessões

## Detalhes Técnicos

### Novo Hook: useRegionSelector

Cria um hook para gerenciar a seleção de região:

- Estado: `{ x, y, width, height }` da região
- Método: `startSelection()` - inicia modo de seleção
- Método: `saveRegion()` - salva no localStorage
- Callback: `onRegionSelected(rect)` - quando usuário termina

### Modificações no useScreenCapture

Adicionar parâmetro opcional de região:

```
captureFrame(region?: { x: number, y: number, width: number, height: number })
```

Se região for fornecida, usa `ctx.drawImage()` com parâmetros de recorte:

```
ctx.drawImage(video, region.x, region.y, region.width, region.height, 0, 0, region.width, region.height)
```

### Modificações no useXpOcr

O hook já funcionará melhor com imagens menores, sem mudanças necessárias.

### Interface do Seletor

Novo componente `RegionSelector`:

```text
┌──────────────────────────────────────────┐
│  Preview da Tela Capturada               │
│                                          │
│   ┌──────────────────┐                   │
│   │ Experience 156k  │ ← Região          │
│   └──────────────────┘   selecionada     │
│                                          │
│  [✓ Confirmar Região] [↺ Redefinir]      │
└──────────────────────────────────────────┘
```

### Fluxo de Uso Atualizado

1. Usuário clica em "Iniciar XP Tracker"
2. Seleciona a janela do jogo
3. **Novo**: Aparece prévia com instrução "Arraste para selecionar a região do XP"
4. Usuário desenha retângulo sobre a área do Experience
5. Clica em "Confirmar"
6. OCR começa a processar apenas essa pequena área

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/hooks/useRegionSelector.ts` | Criar | Hook para gerenciar seleção de região |
| `src/components/xp-tracker/RegionSelector.tsx` | Criar | Componente visual do seletor |
| `src/hooks/useScreenCapture.ts` | Modificar | Adicionar suporte a região no captureFrame |
| `src/components/xp-tracker/WebXpTracker.tsx` | Modificar | Integrar seletor antes do OCR |
| `src/i18n/translations/*.ts` | Modificar | Adicionar textos do seletor |
| `src/i18n/types.ts` | Modificar | Adicionar tipos das novas traduções |

## Benefícios Esperados

- **Performance**: Redução de ~99% no processamento de pixels
- **Precisão**: OCR focado = menos erros de leitura
- **Flexibilidade**: Funciona com qualquer posição da janela de Skills
- **Usabilidade**: Configuração feita uma vez, salva para sempre

