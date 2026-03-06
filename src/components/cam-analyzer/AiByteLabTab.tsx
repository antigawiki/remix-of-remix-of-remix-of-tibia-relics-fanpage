import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Play, Send, Trash2, Bot, User, Loader2, FlaskConical, Binary } from 'lucide-react';
import { DatLoader } from '@/lib/tibiaRelic/datLoader';
import { runDeepTrace, findFrameAtTime, getCamFileInfo, type DeepTraceResult } from '@/lib/tibiaRelic/deepTracer';
import DatSprTester from './DatSprTester';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AiByteLabTabProps {
  fileBuffer: ArrayBuffer | null;
  fileName: string;
  loadDat: () => Promise<DatLoader>;
}

export default function AiByteLabTab({ fileBuffer, fileName, loadDat }: AiByteLabTabProps) {
  const [startMinute, setStartMinute] = useState(59);
  const [frameCount, setFrameCount] = useState(30);
  const [tracing, setTracing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [traceResult, setTraceResult] = useState<DeepTraceResult | null>(null);
  const [fileInfo, setFileInfo] = useState<{ totalFrames: number; totalMs: number } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [customQuestion, setCustomQuestion] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load file info on first interaction
  const ensureFileInfo = useCallback(() => {
    if (!fileBuffer || fileInfo) return;
    const info = getCamFileInfo(fileBuffer);
    setFileInfo(info);
  }, [fileBuffer, fileInfo]);

  const runTrace = useCallback(async () => {
    if (!fileBuffer) return;
    ensureFileInfo();
    setTracing(true);
    setTraceResult(null);

    try {
      const dat = await loadDat();
      const startFrame = findFrameAtTime(fileBuffer, startMinute * 60);
      const result = runDeepTrace(fileBuffer, dat, startFrame, frameCount, (cur, total) => {
        setProgress({ current: cur, total });
      });
      setTraceResult(result);

      if (!fileInfo) {
        const info = getCamFileInfo(fileBuffer);
        setFileInfo(info);
      }
    } catch (err) {
      console.error('Deep trace failed:', err);
    } finally {
      setTracing(false);
    }
  }, [fileBuffer, loadDat, startMinute, frameCount, ensureFileInfo, fileInfo]);

  const streamAiAnalysis = useCallback(async (question?: string) => {
    if (!traceResult) return;
    setStreaming(true);

    const userMsg: Message = {
      role: 'user',
      content: question || `Analise os ${traceResult.frames.length} frames (${traceResult.startFrameIndex}→${traceResult.endFrameIndex}) do arquivo "${fileName}" e identifique divergências de protocolo.`,
    };
    setMessages(prev => [...prev, userMsg]);

    // Prepare compact frame data for the AI (aggressively limit to avoid 400 errors)
    const compactFrames = traceResult.frames.map(f => ({
      idx: f.frameIndex,
      ts: f.timestamp,
      size: f.payloadSize,
      hex: f.hexDump.slice(0, 120), // first ~40 bytes
      cam: `${f.camBefore.x},${f.camBefore.y},${f.camBefore.z}→${f.camAfter.x},${f.camAfter.y},${f.camAfter.z}`,
      ops: f.opcodeTraces.map(o => o.opcodeName),
      crAdd: f.creaturesAdded.slice(0, 5),
      crRem: f.creaturesRemoved.slice(0, 5),
      crCount: f.creaturesAfter.length,
      err: f.error ? f.error.slice(0, 100) : null,
      bytesLeft: f.bytesLeft,
    }));

    // Limit conversation history to last 4 messages to keep payload small
    const recentHistory = messages.slice(-4).map(m => ({
      role: m.role,
      content: m.content.slice(0, 2000),
    }));

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-cam-protocol`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          frameTraces: compactFrames,
          question: question || undefined,
          conversationHistory: recentHistory,
        }),
      });

      if (!resp.ok || !resp.body) {
        const errText = await resp.text();
        let errorMsg = `Erro ${resp.status}`;
        try {
          const errJson = JSON.parse(errText);
          errorMsg = errJson.error || errorMsg;
        } catch { /* ignore */ }
        setMessages(prev => [...prev, { role: 'assistant', content: `❌ ${errorMsg}` }]);
        setStreaming(false);
        return;
      }

      // Stream SSE
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let assistantSoFar = '';
      let streamDone = false;

      const upsertAssistant = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && prev.length > 0 && prev[prev.length - 2]?.content === userMsg.content) {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
          }
          return [...prev, { role: 'assistant', content: assistantSoFar }];
        });
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsertAssistant(content);
          } catch { /* ignore */ }
        }
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ Erro: ${e?.message || 'Unknown'}` }]);
    } finally {
      setStreaming(false);
    }
  }, [traceResult, messages, fileName]);

  const handleSendQuestion = useCallback(() => {
    if (!customQuestion.trim() || streaming) return;
    const q = customQuestion.trim();
    setCustomQuestion('');
    streamAiAnalysis(q);
  }, [customQuestion, streaming, streamAiAnalysis]);

  return (
    <Tabs defaultValue="protocol" className="space-y-4">
      <TabsList>
        <TabsTrigger value="protocol" className="gap-1">
          <Binary className="w-3 h-3" /> Protocol Traces
        </TabsTrigger>
        <TabsTrigger value="dat-spr" className="gap-1">
          <FlaskConical className="w-3 h-3" /> DAT/SPR Tester
        </TabsTrigger>
      </TabsList>

      <TabsContent value="protocol">
        <div className="space-y-4">
          {/* Controls */}
          <Card className="p-4 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Minuto inicial</label>
                <Input
                  type="number"
                  value={startMinute}
                  onChange={e => setStartMinute(Number(e.target.value))}
                  className="w-24"
                  min={0}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Qtd frames</label>
                <Input
                  type="number"
                  value={frameCount}
                  onChange={e => setFrameCount(Number(e.target.value))}
                  className="w-24"
                  min={1}
                  max={100}
                />
              </div>
              <Button onClick={runTrace} disabled={!fileBuffer || tracing}>
                <Play className="w-4 h-4 mr-2" />
                {tracing ? 'Traçando...' : 'Extrair Traces'}
              </Button>
              {traceResult && (
                <Button onClick={() => streamAiAnalysis()} disabled={streaming}>
                  <Bot className="w-4 h-4 mr-2" />
                  {streaming ? 'Analisando...' : 'Analisar com IA'}
                </Button>
              )}
            </div>

            {tracing && (
              <div className="space-y-1">
                <Progress value={progress.total ? (progress.current / progress.total) * 100 : 0} />
                <p className="text-xs text-muted-foreground">
                  Frame {progress.current.toLocaleString()} / {progress.total.toLocaleString()}
                </p>
              </div>
            )}

            {fileInfo && (
              <p className="text-xs text-muted-foreground">
                Arquivo: {(fileInfo.totalMs / 1000 / 60).toFixed(1)} min, {fileInfo.totalFrames.toLocaleString()} frames
              </p>
            )}
          </Card>

          {/* Trace Summary */}
          {traceResult && (
            <Card className="p-4">
              <div className="flex flex-wrap gap-4 mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">Frames Traçados</p>
                  <p className="text-lg font-bold text-foreground">{traceResult.frames.length}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Range</p>
                  <p className="text-lg font-bold text-foreground">{traceResult.startFrameIndex}→{traceResult.endFrameIndex}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Com Erro</p>
                  <p className="text-lg font-bold text-destructive">{traceResult.frames.filter(f => f.error).length}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Scroll/Map Ops</p>
                  <p className="text-lg font-bold text-primary">
                    {traceResult.frames.filter(f =>
                      f.opcodeTraces.some(o => [0x64, 0x65, 0x66, 0x67, 0x68, 0xbe, 0xbf].includes(o.opcode))
                    ).length}
                  </p>
                </div>
              </div>

              {/* Compact frame list */}
              <div className="max-h-[200px] overflow-auto">
                <div className="space-y-1">
                  {traceResult.frames.map(f => {
                    const hasScroll = f.opcodeTraces.some(o => [0x64, 0x65, 0x66, 0x67, 0x68].includes(o.opcode));
                    const hasFloor = f.opcodeTraces.some(o => [0xbe, 0xbf].includes(o.opcode));
                    const hasCr = f.opcodeTraces.some(o => [0x6a, 0x6b, 0x6c, 0x6d].includes(o.opcode));
                    return (
                      <div key={f.frameIndex} className={`text-[10px] font-mono px-2 py-0.5 rounded flex items-center gap-2 ${f.error ? 'bg-destructive/10' : 'bg-muted/30'}`}>
                        <span className="text-muted-foreground w-12">#{f.frameIndex}</span>
                        <span className="w-14">{(f.timestamp / 1000).toFixed(1)}s</span>
                        <span className="w-10">{f.payloadSize}B</span>
                        <span className="flex-1 truncate">{f.opcodeTraces.map(o => o.opcodeName).join(' → ')}</span>
                        <div className="flex gap-1">
                          {hasScroll && <Badge variant="default" className="text-[8px] h-4 px-1">SCROLL</Badge>}
                          {hasFloor && <Badge variant="secondary" className="text-[8px] h-4 px-1">FLOOR</Badge>}
                          {hasCr && f.creaturesAdded.length > 0 && <Badge variant="outline" className="text-[8px] h-4 px-1">+{f.creaturesAdded.length}cr</Badge>}
                          {f.error && <Badge variant="destructive" className="text-[8px] h-4 px-1">ERR</Badge>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          )}

          {/* AI Chat */}
          {traceResult && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Bot className="w-4 h-4" /> AI Protocol Analyst
                </h2>
                {messages.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setMessages([])}>
                    <Trash2 className="w-3 h-3 mr-1" /> Limpar
                  </Button>
                )}
              </div>

              {/* Messages */}
              <ScrollArea className="h-[400px] mb-3" ref={scrollRef}>
                <div className="space-y-3 pr-4">
                  {messages.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      Extraia os traces e clique "Analisar com IA" para iniciar a análise do protocolo.
                    </p>
                  )}
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-lg p-3 text-sm ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      }`}>
                        <div className="flex items-center gap-1 mb-1">
                          {msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                          <span className="text-[10px] font-semibold uppercase">{msg.role === 'user' ? 'Você' : 'Gemini 2.5 Pro'}</span>
                        </div>
                        <div className="whitespace-pre-wrap text-xs leading-relaxed">{msg.content}</div>
                      </div>
                    </div>
                  ))}
                  {streaming && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" /> Analisando protocolo...
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="flex gap-2">
                <Textarea
                  value={customQuestion}
                  onChange={e => setCustomQuestion(e.target.value)}
                  placeholder="Pergunte sobre frames específicos, opcodes, byte drift..."
                  className="min-h-[40px] max-h-[80px] text-xs"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendQuestion();
                    }
                  }}
                />
                <Button onClick={handleSendQuestion} disabled={!customQuestion.trim() || streaming} size="sm">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          )}
        </div>
      </TabsContent>

      <TabsContent value="dat-spr">
        <DatSprTester loadDat={loadDat} />
      </TabsContent>
    </Tabs>
  );
}
