

## Ferramenta de Diagnostico: Cam Packet Analyzer

### Problema

O player WASM (tibiarc C++) tambem apresenta saltos de posicao/andar durante a reproducao. O debug panel atual so funciona com o parser JS e em tempo real (buffer circular de 2000 eventos). Nao ha como analisar o arquivo .cam inteiro offline para identificar exatamente quais pacotes causam os saltos.

### Solucao

Criar uma pagina **Cam Analyzer** que faz parsing **offline completo** de um arquivo .cam usando o parser JS, processando TODOS os frames de uma vez e gerando um relatorio completo com:

1. **Tabela de anomalias**: Lista todos os momentos onde ocorre salto de posicao (player ou camera move > 1 tile em um unico frame), troca de andar inesperada, ou WALK_FAIL
2. **Timeline visual**: Grafico simples mostrando X, Y, Z do player ao longo do tempo — saltos aparecem como picos visuais obvios
3. **Detalhes por frame**: Ao clicar numa anomalia, mostra os opcodes exatos daquele frame e os adjacentes, com before/after do estado completo
4. **Exportacao**: Dump completo em JSON para analise externa

### Abordagem tecnica

A ferramenta reutiliza o `PacketParser` e `GameState` existentes, mas em modo batch (nao real-time). Processa todos os frames do .cam em sequencia, capturando um snapshot do estado apos cada frame e comparando com o anterior para detectar anomalias.

### Mudancas por arquivo

#### 1. Nova pagina: `src/pages/CamAnalyzerPage.tsx`

- Upload de .cam (mesmo mecanismo do player)
- Botao "Analisar" que processa todos os frames offline
- Mostra progresso (X de Y frames)
- Apos analise, renderiza:
  - **Resumo**: total frames, total anomalias, tipos de anomalia
  - **Grafico de posicao**: recharts LineChart com camX, camY, camZ ao longo do tempo (ms), anomalias marcadas como pontos vermelhos
  - **Tabela de anomalias**: timestamp, tipo (JUMP/FLOOR_CHANGE/WALK_FAIL), detalhes (from->to), opcode que causou
  - **Painel de detalhes**: ao clicar uma anomalia, mostra os opcodes desse frame e +-2 frames adjacentes com estado completo

#### 2. Logica de analise: `src/lib/tibiaRelic/camAnalyzer.ts`

```text
interface AnalysisResult {
  totalFrames: number;
  totalMs: number;
  anomalies: Anomaly[];
  positionTimeline: { ms: number; camX: number; camY: number; camZ: number; playerX: number; playerY: number; playerZ: number }[];
  frameDetails: FrameDetail[]; // opcodes por frame
}

interface Anomaly {
  frameIndex: number;
  timestamp: number;
  type: 'POSITION_JUMP' | 'FLOOR_JUMP' | 'WALK_FAIL' | 'DESYNC';
  description: string;
  before: { camX, camY, camZ, playerX, playerY, playerZ };
  after: { camX, camY, camZ, playerX, playerY, playerZ };
  opcodes: number[]; // opcodes do frame
}
```

Logica:
- Para cada frame do .cam, salva o estado (cam/player pos) ANTES
- Processa o frame com PacketParser (modo seekMode=true para pular animacoes)
- Salva estado APOS
- Compara: se |deltaX| > 2 ou |deltaY| > 2 ou deltaZ != 0 (sem ser floorUp/Down), marca como anomalia
- Captura os opcodes brutos de cada frame para referencia

#### 3. Instrumentacao do PacketParser

Adicionar um modo `analyzerMode` opcional que, quando ativo:
- Registra cada opcode processado num array temporario por frame (sem o overhead do DebugLogger circular)
- Expoe `getLastFrameOpcodes(): number[]`

#### 4. Rota no `App.tsx`

Adicionar rota `/cam-analyzer` (ou na URL secreta admin existente)

### Resultado esperado

Ao carregar um .cam problematico, o usuario vera imediatamente:
- Quantas anomalias existem e em quais timestamps
- No grafico, os picos de posicao sao visiveis
- Ao clicar num pico, ve exatamente qual opcode causou o salto
- Com essa informacao, podemos corrigir o handler especifico no parser

### Alternativa considerada

Interceptar o WASM player com logging: impossivel sem recompilar o C++. A vantagem da abordagem JS offline e que temos controle total e podemos comparar frame a frame com o que o WASM produz visualmente.

