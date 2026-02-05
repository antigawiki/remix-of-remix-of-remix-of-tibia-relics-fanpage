
# Plano: XP Tracker com Captura de Tela e OCR

## Visão Geral

Criar uma nova ferramenta "XP Tracker" que utiliza a API de Captura de Tela do navegador combinada com OCR (Tesseract.js) para ler automaticamente o valor de XP exibido no jogo Tibia e calcular estatísticas em tempo real.

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────┐
│                      XP Tracker Page                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │   Screen    │───▶│  Tesseract   │───▶│  XP State     │  │
│  │   Capture   │    │  OCR Engine  │    │  Calculator   │  │
│  │   API       │    │              │    │               │  │
│  └─────────────┘    └──────────────┘    └───────────────┘  │
│                                                ▼            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Real-time Dashboard                     │   │
│  │  • XP Atual    • XP Ganho    • XP/Hora   • Projeção │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Picture-in-Picture (Modo Flutuante)          │   │
│  │  Painel minimalista sempre visível sobre outros apps │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Funcionalidades

1. **Iniciar Captura de Tela**
   - Solicita permissão via `navigator.mediaDevices.getDisplayMedia()`
   - Permite selecionar janela/monitor do Tibia

2. **OCR com Tesseract.js**
   - Captura frames da tela em intervalo (a cada 2-3 segundos)
   - Extrai região onde aparece "Experience" e o valor numérico
   - Parse do valor de XP do texto reconhecido

3. **Cálculos em Tempo Real**
   - XP inicial (primeiro valor capturado)
   - XP atual (último valor reconhecido)
   - XP ganho na sessão
   - Tempo de sessão
   - XP por hora
   - Projeção de XP (baseado na taxa atual)

4. **Modo Flutuante (Picture-in-Picture)**
   - Usa Document Picture-in-Picture API
   - Painel minimalista com fonte grande
   - Permanece sobre outros aplicativos

## Arquivos a Criar/Modificar

### Novos Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/XpTrackerPage.tsx` | Página principal do XP Tracker |
| `src/hooks/useScreenCapture.ts` | Hook para gerenciar captura de tela |
| `src/hooks/useXpOcr.ts` | Hook para OCR com Tesseract.js |
| `src/hooks/useXpTracker.ts` | Hook para cálculos e estado do tracker |
| `src/components/xp-tracker/XpDashboard.tsx` | Dashboard com estatísticas |
| `src/components/xp-tracker/PipPanel.tsx` | Painel para modo flutuante |

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/App.tsx` | Adicionar rota `/xp-tracker` |
| `src/components/Sidebar.tsx` | Adicionar link para XP Tracker |
| `src/components/Header.tsx` | Adicionar no menu mobile |
| `src/i18n/types.ts` | Adicionar tipos para traduções |
| `src/i18n/translations/pt.ts` | Traduções PT |
| `src/i18n/translations/en.ts` | Traduções EN |
| `src/i18n/translations/es.ts` | Traduções ES |
| `src/i18n/translations/pl.ts` | Traduções PL |
| `package.json` | Adicionar dependência tesseract.js |

## Interface do Usuário

### Tela Principal
- Header com título "XP Tracker" e ícone
- Botão "Iniciar XP Tracker" (destaque)
- Preview da captura de tela (pequeno)
- Cards de estatísticas:
  - XP Atual (fonte grande)
  - XP Ganho
  - Tempo de Sessão
  - XP/Hora
  - Projeção (próximas 1h, 2h)
- Botão "Modo Flutuante" para ativar PiP
- Botão "Parar" para encerrar sessão

### Painel Flutuante (PiP)
Design minimalista com fundo semi-transparente:
```text
┌────────────────────────┐
│ XP: 1,234,567          │
│ +45,230 (23.5k/h)      │
│ ⏱ 1h 55min             │
└────────────────────────┘
```

---

## Detalhes Técnicos

### Dependência
```json
{
  "tesseract.js": "^5.0.0"
}
```

### Hook de Captura de Tela
```typescript
// useScreenCapture.ts
const useScreenCapture = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const startCapture = async () => {
    const mediaStream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: "window" },
      audio: false
    });
    setStream(mediaStream);
    setIsCapturing(true);
  };

  const captureFrame = () => {
    // Captura frame do video para canvas
    // Retorna ImageData para OCR
  };

  return { stream, isCapturing, startCapture, stopCapture, captureFrame };
};
```

### Hook de OCR
```typescript
// useXpOcr.ts
const useXpOcr = () => {
  const workerRef = useRef<Worker | null>(null);

  const initWorker = async () => {
    const worker = await createWorker('eng');
    workerRef.current = worker;
  };

  const recognizeXp = async (imageData: ImageData) => {
    const result = await workerRef.current.recognize(imageData);
    // Parse "Experience    156,507" → 156507
    return parseXpFromText(result.data.text);
  };

  return { initWorker, recognizeXp, terminateWorker };
};
```

### Cálculos de XP
```typescript
// useXpTracker.ts
interface XpTrackerState {
  initialXp: number;
  currentXp: number;
  startTime: Date;
  xpGained: number;     // currentXp - initialXp
  sessionDuration: number; // em segundos
  xpPerHour: number;    // (xpGained / sessionDuration) * 3600
}
```

### Picture-in-Picture
```typescript
const openPipPanel = async () => {
  if (!('documentPictureInPicture' in window)) {
    toast.error('Modo flutuante não suportado neste navegador');
    return;
  }

  const pipWindow = await window.documentPictureInPicture.requestWindow({
    width: 300,
    height: 120
  });

  // Renderiza painel minimalista no pipWindow.document.body
};
```

### Traduções (exemplo PT)
```typescript
xpTracker: {
  title: 'XP Tracker',
  description: 'Rastreie seu ganho de XP em tempo real usando captura de tela',
  startButton: 'Iniciar XP Tracker',
  stopButton: 'Parar',
  floatingMode: 'Modo Flutuante',
  selectWindow: 'Selecione a janela do Tibia',
  currentXp: 'XP Atual',
  xpGained: 'XP Ganho',
  sessionTime: 'Tempo de Sessão',
  xpPerHour: 'XP/Hora',
  projection: 'Projeção',
  noPermission: 'Permissão de captura negada',
  pipNotSupported: 'Modo flutuante não suportado neste navegador',
  processing: 'Processando...',
  waitingCapture: 'Aguardando captura...',
}
```

## Considerações

1. **Compatibilidade**: Screen Capture API e Document Picture-in-Picture são suportados em Chrome/Edge. Firefox tem suporte parcial. Será exibido aviso para navegadores não compatíveis.

2. **Performance**: O OCR será executado a cada 2-3 segundos para não sobrecarregar o navegador. Tesseract.js roda em Web Worker.

3. **Privacidade**: Todo processamento é feito localmente no navegador. Nenhum dado é enviado para servidores.

4. **Precisão OCR**: A região de XP no Tibia tem fonte específica. Pode ser necessário ajustar contraste/preprocessamento da imagem para melhor reconhecimento.
