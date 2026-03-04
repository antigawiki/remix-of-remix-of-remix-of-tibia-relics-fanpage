import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Play, Download, ChevronDown, Check, X } from 'lucide-react';
import { DatLoader } from '@/lib/tibiaRelic/datLoader';
import { runProtocolLab, STRATEGIES, type LabResult, type ErrorFrame } from '@/lib/tibiaRelic/camProtocolLab';

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function HexDump({ data, maxBytes = 128 }: { data: Uint8Array; maxBytes?: number }) {
  const bytes = Array.from(data.slice(0, maxBytes));
  return (
    <div className="font-mono text-[10px] leading-relaxed bg-muted/50 rounded p-2 overflow-x-auto">
      {bytes.map((b, i) => (
        <span key={i} className={`${i > 0 && i % 16 === 0 ? 'block' : ''} ${i % 2 === 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
          {b.toString(16).toUpperCase().padStart(2, '0')}{' '}
        </span>
      ))}
      {data.length > maxBytes && <span className="text-muted-foreground">... +{data.length - maxBytes} bytes</span>}
    </div>
  );
}

function ErrorFrameRow({ ef }: { ef: ErrorFrame }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <TableRow className="cursor-pointer hover:bg-accent/50">
          <TableCell className="text-xs font-mono">{ef.frameIndex}</TableCell>
          <TableCell className="text-xs">{formatMs(ef.timestamp)}</TableCell>
          <TableCell className="text-xs font-mono">Z={ef.camZ}</TableCell>
          <TableCell className="text-xs font-mono">
            {ef.failedOpcode !== null ? '0x' + ef.failedOpcode.toString(16).toUpperCase() : '—'}
          </TableCell>
          <TableCell>
            {ef.bestStrategy ? (
              <Badge variant="secondary" className="text-xs">{ef.bestStrategy}</Badge>
            ) : (
              <Badge variant="destructive" className="text-xs">Nenhuma</Badge>
            )}
          </TableCell>
          <TableCell className="text-xs max-w-[300px] truncate">{ef.error}</TableCell>
          <TableCell><ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} /></TableCell>
        </TableRow>
      </CollapsibleTrigger>
      <CollapsibleContent asChild>
        <tr>
          <td colSpan={7} className="p-0">
            <div className="p-3 bg-muted/30 space-y-3">
              {/* Strategy results */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Resultados por Estratégia</p>
                <div className="grid grid-cols-5 gap-2">
                  {ef.strategyResults.map(sr => (
                    <div key={sr.strategy.name} className={`rounded p-2 text-xs ${sr.success ? 'bg-accent/20 border border-accent/40' : 'bg-destructive/10 border border-destructive/30'}`}>
                      <div className="flex items-center gap-1 mb-1">
                        {sr.success ? <Check className="w-3 h-3 text-accent-foreground" /> : <X className="w-3 h-3 text-destructive" />}
                        <span className="font-semibold">{sr.strategy.name}: {sr.strategy.label}</span>
                      </div>
                      <p className="font-mono">{sr.opcodesProcessed} opcodes</p>
                      {sr.error && <p className="text-destructive truncate mt-1">{sr.error}</p>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Trace log for best strategy */}
              {ef.bestStrategy && (() => {
                const best = ef.strategyResults.find(sr => sr.strategy.name === ef.bestStrategy);
                if (!best || best.traceLog.length === 0) return null;
                return (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Trace (Estratégia {ef.bestStrategy})</p>
                    <div className="max-h-[150px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs w-32">Operação</TableHead>
                            <TableHead className="text-xs w-16">Floor</TableHead>
                            <TableHead className="text-xs w-20">Pos Antes</TableHead>
                            <TableHead className="text-xs w-20">Pos Depois</TableHead>
                            <TableHead className="text-xs w-20">Bytes</TableHead>
                            <TableHead className="text-xs">Erro</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {best.traceLog.map((t, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs font-mono">{t.op}</TableCell>
                              <TableCell className="text-xs font-mono">{t.floor ?? '—'}</TableCell>
                              <TableCell className="text-xs font-mono">{t.posBefore}</TableCell>
                              <TableCell className="text-xs font-mono">{t.posAfter}</TableCell>
                              <TableCell className="text-xs font-mono">{t.bytesConsumed}</TableCell>
                              <TableCell className="text-xs text-destructive">{t.error ?? ''}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                );
              })()}

              {/* Hex dump */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Payload ({ef.payload.length} bytes)</p>
                <HexDump data={ef.payload} maxBytes={256} />
              </div>
            </div>
          </td>
        </tr>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface ProtocolLabTabProps {
  fileBuffer: ArrayBuffer | null;
  fileName: string;
  loadDat: () => Promise<DatLoader>;
}

export default function ProtocolLabTab({ fileBuffer, fileName, loadDat }: ProtocolLabTabProps) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, phase: '' });
  const [result, setResult] = useState<LabResult | null>(null);

  const runLab = useCallback(async () => {
    if (!fileBuffer) return;
    setRunning(true);
    setResult(null);

    try {
      const dat = await loadDat();
      const res = await runProtocolLab(fileBuffer, dat, (cur, total, phase) => {
        setProgress({ current: cur, total, phase });
      });
      setResult(res);
    } catch (err) {
      console.error('Protocol Lab failed:', err);
    } finally {
      setRunning(false);
    }
  }, [fileBuffer, loadDat]);

  const exportJSON = useCallback(() => {
    if (!result) return;
    // Strip payload Uint8Arrays for JSON export
    const exportData = {
      ...result,
      errorFrames: result.errorFrames.map(ef => ({
        ...ef,
        payload: `<${ef.payload.length} bytes>`,
        strategyResults: ef.strategyResults.map(sr => ({ ...sr })),
      })),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.replace('.cam', '')}-protocol-lab.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result, fileName]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Button onClick={runLab} disabled={!fileBuffer || running}>
            <Play className="w-4 h-4 mr-2" />{running ? 'Executando...' : 'Executar Protocol Lab'}
          </Button>
          {result && (
            <Button variant="outline" onClick={exportJSON}>
              <Download className="w-4 h-4 mr-2" />Exportar JSON
            </Button>
          )}
        </div>
        {running && (
          <div className="space-y-1">
            <Progress value={progress.total ? (progress.current / progress.total) * 100 : 0} />
            <p className="text-xs text-muted-foreground">
              {progress.phase}: {progress.current.toLocaleString()} / {progress.total.toLocaleString()}
            </p>
          </div>
        )}
      </Card>

      {result && (
        <>
          {/* Summary */}
          <Card className="p-4 space-y-3">
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-xs text-muted-foreground">Total Frames</p>
                <p className="text-lg font-bold text-foreground">{result.totalFrames.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Frames OK</p>
                <p className="text-lg font-bold text-primary">{result.successFrames.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Frames com Erro</p>
                <p className="text-lg font-bold text-destructive">{result.errorFrames.length}</p>
              </div>
            </div>

            {/* Strategy summary */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Qual estratégia resolveu os erros?</p>
              <div className="flex flex-wrap gap-2">
                {STRATEGIES.map(s => {
                  const count = result.strategySummary[s.name] || 0;
                  return (
                    <Badge key={s.name} variant={count > 0 ? 'default' : 'secondary'} className="text-xs">
                      {s.name}: {s.label} — {count} frames
                    </Badge>
                  );
                })}
                <Badge variant="destructive" className="text-xs">
                  Irrecuperáveis: {result.errorFrames.filter(ef => !ef.bestStrategy).length}
                </Badge>
              </div>
            </div>

            {/* Opcode error map */}
            {Object.keys(result.opcodeErrorMap).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Erros por Opcode</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(result.opcodeErrorMap).sort((a, b) => b[1] - a[1]).map(([op, count]) => (
                    <Badge key={op} variant="outline" className="text-xs font-mono">
                      {op}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendation */}
            <div className="bg-primary/10 border border-primary/20 rounded p-3">
              <p className="text-xs font-semibold text-primary mb-1">Recomendação</p>
              <p className="text-sm text-foreground">{result.recommendation}</p>
            </div>
          </Card>

          {/* Error frames table */}
          {result.errorFrames.length > 0 && (
            <Card className="p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Frames com Erro ({result.errorFrames.length})
              </h2>
              <div className="max-h-[600px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs w-16">Frame</TableHead>
                      <TableHead className="text-xs w-20">Tempo</TableHead>
                      <TableHead className="text-xs w-16">Floor</TableHead>
                      <TableHead className="text-xs w-20">Opcode</TableHead>
                      <TableHead className="text-xs w-24">Melhor</TableHead>
                      <TableHead className="text-xs">Erro</TableHead>
                      <TableHead className="text-xs w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.errorFrames.slice(0, 200).map(ef => (
                      <ErrorFrameRow key={ef.frameIndex} ef={ef} />
                    ))}
                  </TableBody>
                </Table>
                {result.errorFrames.length > 200 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Mostrando 200 de {result.errorFrames.length} frames com erro
                  </p>
                )}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
