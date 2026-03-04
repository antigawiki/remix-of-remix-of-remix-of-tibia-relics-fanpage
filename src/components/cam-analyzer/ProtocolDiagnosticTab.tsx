import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Play, Download, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { DatLoader } from '@/lib/tibiaRelic/datLoader';
import { runProtocolDiagnostic, type ProtocolDiagnosticResult, CPP_OPCODE_SPEC } from '@/lib/tibiaRelic/protocolDiagnostic';

interface Props {
  fileBuffer: ArrayBuffer | null;
  fileName: string;
  loadDat: () => Promise<DatLoader>;
}

function fmtOp(op: number): string {
  return '0x' + op.toString(16).toUpperCase().padStart(2, '0');
}

function fmtMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

export default function ProtocolDiagnosticTab({ fileBuffer, fileName, loadDat }: Props) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<ProtocolDiagnosticResult | null>(null);

  const run = useCallback(async () => {
    if (!fileBuffer) return;
    setRunning(true);
    setResult(null);
    try {
      const dat = await loadDat();
      const res = await runProtocolDiagnostic(fileBuffer, dat, (c, t) => setProgress({ current: c, total: t }));
      setResult(res);
    } catch (e) {
      console.error('Diagnostic failed:', e);
    } finally {
      setRunning(false);
    }
  }, [fileBuffer, loadDat]);

  const exportJSON = useCallback(() => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.replace('.cam', '')}-protocol-diagnostic.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result, fileName]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Button onClick={run} disabled={!fileBuffer || running}>
            <Play className="w-4 h-4 mr-2" />{running ? 'Analisando...' : 'Diagnosticar Protocolo'}
          </Button>
          {result && (
            <Button variant="outline" onClick={exportJSON}>
              <Download className="w-4 h-4 mr-2" />Exportar JSON
            </Button>
          )}
        </div>
        {running && (
          <div className="mt-3 space-y-1">
            <Progress value={progress.total ? (progress.current / progress.total) * 100 : 0} />
            <p className="text-xs text-muted-foreground">Frame {progress.current.toLocaleString()} / {progress.total.toLocaleString()}</p>
          </div>
        )}
      </Card>

      {result && (
        <>
          {/* Summary */}
          <Card className="p-4">
            <h2 className="text-sm font-bold text-foreground mb-3">Resumo</h2>
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-xs text-muted-foreground">Total Frames</p>
                <p className="text-lg font-bold text-foreground">{result.totalFrames.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Duração</p>
                <p className="text-lg font-bold text-foreground">{fmtMs(result.totalMs)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Opcodes Únicos</p>
                <p className="text-lg font-bold text-foreground">{result.opcodeStats.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Frames com Erro</p>
                <p className="text-lg font-bold text-destructive">{result.errorFrameCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Drift Críticos</p>
                <p className="text-lg font-bold text-destructive">{result.criticalDrifts.length}</p>
              </div>
            </div>
          </Card>

          {/* Critical Drifts */}
          {result.criticalDrifts.length > 0 && (
            <Card className="p-4 border-destructive/50">
              <h2 className="text-sm font-bold text-destructive mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Drift Críticos — C++ vs TibiaRelic
              </h2>
              <p className="text-xs text-muted-foreground mb-3">
                Estes opcodes têm tamanhos de payload diferentes entre o parser C++ (tibiarc vanilla) e o protocolo TibiaRelic.
                Cada byte de drift corrompe TODOS os dados subsequentes no frame.
              </p>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Opcode</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="w-20">JS (bytes)</TableHead>
                      <TableHead className="w-20">C++ (bytes)</TableHead>
                      <TableHead className="w-24">Drift/vez</TableHead>
                      <TableHead className="w-20">Ocorrências</TableHead>
                      <TableHead className="w-24">Drift Total</TableHead>
                      <TableHead>Nota</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.criticalDrifts.map((d) => (
                      <TableRow key={d.opcode}>
                        <TableCell className="font-mono text-xs font-bold">{fmtOp(d.opcode)}</TableCell>
                        <TableCell className="text-xs">{d.name}</TableCell>
                        <TableCell className="text-xs font-mono">{String(d.jsBytes)}</TableCell>
                        <TableCell className="text-xs font-mono">
                          {d.cppBytes === 'NOT_HANDLED' ? (
                            <Badge variant="destructive" className="text-xs">N/A</Badge>
                          ) : String(d.cppBytes)}
                        </TableCell>
                        <TableCell className="text-xs font-mono font-bold">
                          {d.driftPerOccurrence === 'CRASH' ? (
                            <Badge variant="destructive" className="text-xs">CRASH</Badge>
                          ) : (
                            <span className="text-destructive">{typeof d.driftPerOccurrence === 'number' && d.driftPerOccurrence > 0 ? '+' : ''}{d.driftPerOccurrence}B</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{d.totalOccurrences.toLocaleString()}</TableCell>
                        <TableCell className="text-xs font-mono font-bold text-destructive">{String(d.totalDriftBytes)}</TableCell>
                        <TableCell className="text-xs max-w-[300px] truncate text-muted-foreground">{d.note}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          {/* Full Opcode Frequency */}
          <Card className="p-4">
            <h2 className="text-sm font-bold text-foreground mb-3">Especificação Completa do Protocolo</h2>
            <p className="text-xs text-muted-foreground mb-3">
              Todos os opcodes encontrados no arquivo .cam, com frequência e comparação C++ vs JS.
            </p>
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Opcode</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="w-20">Qtd</TableHead>
                    <TableHead className="w-24">JS (bytes)</TableHead>
                    <TableHead className="w-24">C++ (bytes)</TableHead>
                    <TableHead className="w-20">Status</TableHead>
                    <TableHead>Nota</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.opcodeStats.map((s) => {
                    const hasDrift = (s.drift !== null && s.drift !== 0) || s.cppBytes === 'NOT_HANDLED';
                    return (
                      <TableRow key={s.opcode} className={hasDrift ? 'bg-destructive/5' : ''}>
                        <TableCell className="font-mono text-xs font-bold">{fmtOp(s.opcode)}</TableCell>
                        <TableCell className="text-xs">{s.name}</TableCell>
                        <TableCell className="text-xs font-mono">{s.count.toLocaleString()}</TableCell>
                        <TableCell className="text-xs font-mono">{String(s.jsBytes)}</TableCell>
                        <TableCell className="text-xs font-mono">
                          {s.cppBytes === 'NOT_HANDLED' ? (
                            <Badge variant="destructive" className="text-xs">N/A</Badge>
                          ) : String(s.cppBytes)}
                        </TableCell>
                        <TableCell>
                          {hasDrift ? (
                            <XCircle className="w-4 h-4 text-destructive" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                        </TableCell>
                        <TableCell className="text-xs max-w-[300px] truncate text-muted-foreground">{s.driftNote}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Problem Frames */}
          {result.problemFrames.length > 0 && (
            <Card className="p-4">
              <h2 className="text-sm font-bold text-foreground mb-3">
                Frames com Problemas ({result.problemFrames.length})
              </h2>
              <div className="max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Frame</TableHead>
                      <TableHead className="w-20">Tempo</TableHead>
                      <TableHead className="w-20">Payload</TableHead>
                      <TableHead className="w-20">Sobra</TableHead>
                      <TableHead>Opcodes</TableHead>
                      <TableHead>Erro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.problemFrames.slice(0, 100).map((f) => (
                      <TableRow key={f.frameIndex}>
                        <TableCell className="text-xs font-mono">{f.frameIndex}</TableCell>
                        <TableCell className="text-xs">{fmtMs(f.timestamp)}</TableCell>
                        <TableCell className="text-xs font-mono">{f.payloadSize}B</TableCell>
                        <TableCell className="text-xs font-mono text-destructive">{f.bytesLeft}B</TableCell>
                        <TableCell className="text-xs font-mono max-w-[200px] truncate">
                          {f.opcodes.map(fmtOp).join(', ')}
                        </TableCell>
                        <TableCell className="text-xs max-w-[300px] truncate text-destructive">{f.error || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
