import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Trash2, Bot, User, Loader2, FlaskConical } from 'lucide-react';
import { DatLoader } from '@/lib/tibiaRelic/datLoader';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface DatSprTesterProps {
  loadDat: () => Promise<DatLoader>;
}

export default function DatSprTester({ loadDat }: DatSprTesterProps) {
  const [startId, setStartId] = useState(100);
  const [count, setCount] = useState(20);
  const [extracting, setExtracting] = useState(false);
  const [datStats, setDatStats] = useState<any>(null);
  const [itemDumps, setItemDumps] = useState<any[] | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [customQuestion, setCustomQuestion] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const extractDatItems = useCallback(async () => {
    setExtracting(true);
    try {
      const dat = await loadDat();

      // Gather stats
      const flagStats: Record<string, number> = {};
      let suspiciousCount = 0;
      let totalItems = dat.items.size;

      for (const [, it] of dat.items) {
        if (it.width > 4 || it.height > 4 || it.anim > 16 || it.spriteIds.length > 256) {
          suspiciousCount++;
        }
      }

      // We need raw bytes — reload the dat file to get hex dumps
      // For now, extract parsed data which the AI can analyze
      const dumps: any[] = [];
      for (let id = startId; id < startId + count && id <= 100 + totalItems; id++) {
        const it = dat.items.get(id);
        if (!it) continue;
        dumps.push({
          id: it.id,
          w: it.width,
          h: it.height,
          layers: it.layers,
          patX: it.patX,
          patY: it.patY,
          patZ: it.patZ,
          anim: it.anim,
          sprCount: it.spriteIds.length,
          spr0: it.spriteIds[0] ?? null,
          sprLast: it.spriteIds[it.spriteIds.length - 1] ?? null,
          maxSpr: it.spriteIds.length > 0 ? Math.max(...it.spriteIds) : 0,
          isGround: it.isGround,
          isStackable: it.isStackable,
          isFluid: it.isFluid,
          isSplash: it.isSplash,
          speed: it.speed,
          elevation: it.elevation,
        });
      }

      // Find max sprite ID across all items
      let maxSpriteId = 0;
      for (const [, it] of dat.items) {
        for (const sid of it.spriteIds) {
          if (sid > maxSpriteId) maxSpriteId = sid;
        }
      }

      const stats = {
        totalItems,
        totalOutfits: dat.outfits.size,
        totalEffects: dat.effects.size,
        totalMissiles: dat.missiles.size,
        suspiciousItems: suspiciousCount,
        maxSpriteId,
        extractedRange: `${startId}-${startId + count - 1}`,
      };

      setDatStats(stats);
      setItemDumps(dumps);
    } catch (err) {
      console.error('DAT extraction failed:', err);
    } finally {
      setExtracting(false);
    }
  }, [loadDat, startId, count]);

  const streamAnalysis = useCallback(async (question?: string) => {
    if (!itemDumps) return;
    setStreaming(true);

    const userMsg: Message = {
      role: 'user',
      content: question || `Analise os ${itemDumps.length} items (IDs ${startId}-${startId + count - 1}) e teste cada hipótese (A-F) de leitura do .dat.`,
    };
    setMessages(prev => [...prev, userMsg]);

    const recentHistory = messages.slice(-4).map(m => ({
      role: m.role,
      content: m.content.slice(0, 2000),
    }));

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-dat-spr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          itemDumps: itemDumps.slice(0, 30),
          datStats,
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
  }, [itemDumps, messages, datStats, startId, count]);

  const handleSendQuestion = useCallback(() => {
    if (!customQuestion.trim() || streaming) return;
    const q = customQuestion.trim();
    setCustomQuestion('');
    streamAnalysis(q);
  }, [customQuestion, streaming, streamAnalysis]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <FlaskConical className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">DAT/SPR Hypothesis Tester</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Extrai items do .dat carregado e envia para a IA testar hipóteses de leitura (flag payloads, sprite ID sizes, etc.)
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Item ID inicial</label>
            <Input
              type="number"
              value={startId}
              onChange={e => setStartId(Number(e.target.value))}
              className="w-24"
              min={100}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Quantidade</label>
            <Input
              type="number"
              value={count}
              onChange={e => setCount(Number(e.target.value))}
              className="w-24"
              min={1}
              max={50}
            />
          </div>
          <Button onClick={extractDatItems} disabled={extracting}>
            <FlaskConical className="w-4 h-4 mr-2" />
            {extracting ? 'Extraindo...' : 'Extrair Items'}
          </Button>
          {itemDumps && (
            <Button onClick={() => streamAnalysis()} disabled={streaming}>
              <Bot className="w-4 h-4 mr-2" />
              {streaming ? 'Analisando...' : 'Testar Hipóteses'}
            </Button>
          )}
        </div>
      </Card>

      {/* Stats & Item Summary */}
      {datStats && itemDumps && (
        <Card className="p-4">
          <div className="flex flex-wrap gap-4 mb-3">
            <div>
              <p className="text-xs text-muted-foreground">Items Total</p>
              <p className="text-lg font-bold text-foreground">{datStats.totalItems}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Suspeitos</p>
              <p className="text-lg font-bold text-destructive">{datStats.suspiciousItems}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Max Sprite ID</p>
              <p className="text-lg font-bold text-primary">{datStats.maxSpriteId}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Range Extraído</p>
              <p className="text-lg font-bold text-foreground">{datStats.extractedRange}</p>
            </div>
          </div>

          <div className="max-h-[200px] overflow-auto">
            <div className="space-y-1">
              {itemDumps.map(d => (
                <div key={d.id} className={`text-[10px] font-mono px-2 py-0.5 rounded flex items-center gap-2 ${
                  (d.w > 4 || d.h > 4 || d.anim > 16) ? 'bg-destructive/10' : 'bg-muted/30'
                }`}>
                  <span className="text-muted-foreground w-12">#{d.id}</span>
                  <span className="w-20">{d.w}x{d.h} L{d.layers}</span>
                  <span className="w-20">pat:{d.patX},{d.patY},{d.patZ}</span>
                  <span className="w-12">a:{d.anim}</span>
                  <span className="w-16">{d.sprCount}spr</span>
                  <span className="flex-1 truncate">spr0={d.spr0}</span>
                  <div className="flex gap-1">
                    {d.isGround && <Badge variant="default" className="text-[8px] h-4 px-1">GND</Badge>}
                    {d.isStackable && <Badge variant="secondary" className="text-[8px] h-4 px-1">STK</Badge>}
                    {d.isFluid && <Badge variant="outline" className="text-[8px] h-4 px-1">FLD</Badge>}
                    {(d.w > 4 || d.h > 4) && <Badge variant="destructive" className="text-[8px] h-4 px-1">BIG</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* AI Chat */}
      {itemDumps && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Bot className="w-4 h-4" /> AI DAT/SPR Analyst
            </h2>
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setMessages([])}>
                <Trash2 className="w-3 h-3 mr-1" /> Limpar
              </Button>
            )}
          </div>

          <ScrollArea className="h-[400px] mb-3" ref={scrollRef}>
            <div className="space-y-3 pr-4">
              {messages.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">
                  Extraia os items e clique "Testar Hipóteses" para iniciar a análise das flags do .dat.
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
                  <Loader2 className="w-3 h-3 animate-spin" /> Testando hipóteses...
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex gap-2">
            <Textarea
              value={customQuestion}
              onChange={e => setCustomQuestion(e.target.value)}
              placeholder="Pergunte sobre flags específicas, compare hipóteses, peça hex dump detalhado..."
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
  );
}
