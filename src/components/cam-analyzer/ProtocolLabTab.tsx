import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Play, Download, ChevronDown, Check, X, AlertTriangle } from 'lucide-react';
import { DatLoader } from '@/lib/tibiaRelic/playerDatLoader';
import { runProtocolLab, STRATEGIES, type LabResult, type ErrorFrame, type AnomalyType } from '@/lib/tibiaRelic/camProtocolLab';

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const ANOMALY_COLORS: Record<AnomalyType, string> = {
  PARSE_ERROR: 'bg-destructive/20 text-destructive border-destructive/40',
  DESYNC: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
  FLOOR_JUMP: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
  POSITION_JUMP: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  BYTES_LEFTOVER: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
};

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
          <TableCell className="text-xs">
            <div className="flex flex-wrap gap-1">
              {ef.anomalies.map((a, i) => (
                <Badge key={i} variant="outline" className={`text-[10px] ${ANOMALY_COLORS[a.type]}`}>
                  {a.type}
                </Badge>
              ))}
            </div>
          </TableCell>
          <TableCell className="text-xs font-mono">
            {ef.bytesLeftover > 0 ? <span className="text-blue-400">{ef.bytesLeftover}B</span> : '—'}
          </TableCell>
          <TableCell>
            {ef.bestStrategy ? (
              <Badge variant="secondary" className="text-xs">{ef.bestStrategy}</Badge>
            ) : (
              <Badge variant="destructive" className="text-xs">—</Badge>
            )}
          </TableCell>
          <TableCell><ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} /></TableCell>
        </TableRow>
      </CollapsibleTrigger>
      <CollapsibleContent asChild>
        <tr>
          <td colSpan={7} className="p-0">
            <div className="p-3 bg-muted/30 space-y-3">
              {/* Anomaly details */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Anomalias Detectadas</p>
                <div className="space-y-1">
                  {ef.anomalies.map((a, i) => (
                    <div key={i} className={`text-xs p-1.5 rounded border ${ANOMALY_COLORS[a.type]}`}>
                      <span className="font-semibold">{a.type}</span>: {a.detail}
                    </div>
                  ))}
                </div>
              </div>

              {/* Position info */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Antes: </span>
                  <span className="font-mono">
                    Cam({ef.camPosBefore.x},{ef.camPosBefore.y},{ef.camPosBefore.z})
                    {ef.playerPosBefore && ` Player(${ef.playerPosBefore.x},${ef.playerPosBefore.y},${ef.playerPosBefore.z})`}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Depois: </span>
                  <span className="font-mono">
                    Cam({ef.camPosAfter.x},{ef.camPosAfter.y},{ef.camPosAfter.z})
                    {ef.playerPosAfter && ` Player(${ef.playerPosAfter.x},${ef.playerPosAfter.y},${ef.playerPosAfter.z})`}
                  </span>
                </div>
              </div>

              {/* Strategy comparison */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Comparação de Estratégias</p>
                <div className="grid grid-cols-5 gap-2">
                  {ef.strategyResults.map(sr => (
                    <div key={sr.strategy.name} className={`rounded p-2 text-xs border ${
                      sr.success && sr.playerFloorMatch && sr.playerCamDelta <= 2
                        ? 'bg-accent/20 border-accent/40'
                        : sr.success
                        ? 'bg-yellow-500/10 border-yellow-500/30'
                        : 'bg-destructive/10 border-destructive/30'
                    }`}>
                      <div className="flex items-center gap-1 mb-1">
                        {sr.success ? <Check className="w-3 h-3" /> : <X className="w-3 h-3 text-destructive" />}
                        <span className="font-semibold">{sr.strategy.name}: {sr.strategy.label}</span>
                      </div>
                      <p className="font-mono">{sr.opcodesProcessed} ops</p>
                      <p className="font-mono">Δ={sr.playerCamDelta} {sr.playerFloorMatch ? '✓Z' : '✗Z'}</p>
                      <p className="font-mono">{sr.bytesLeft}B left</p>
                      {sr.error && <p className="text-destructive truncate mt-1 text-[10px]">{sr.error}</p>}
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

              {/* Opcodes + Hex dump */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Opcodes ({ef.opcodes.length})</p>
                  <div className="font-mono text-[10px] bg-muted/50 rounded p-2">
                    {ef.opcodes.map(o => '0x' + o.toString(16).toUpperCase()).join(' → ')}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Payload ({ef.payload.length} bytes)</p>
                  <HexDump data={ef.payload} maxBytes={128} />
                </div>
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
  const [filterType, setFilterType] = useState<AnomalyType | 'ALL'>('ALL');

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
    const exportData = {
      ...result,
      errorFrames: result.errorFrames.map(ef => ({
        ...ef,
        payload: `<${ef.payload.length} bytes>`,
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

  const filteredFrames = result?.errorFrames.filter(ef =>
    filterType === 'ALL' || ef.anomalies.some(a => a.type === filterType)
  ) ?? [];

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
                <p className="text-xs text-muted-foreground">Frames com Anomalia</p>
                <p className="text-lg font-bold text-destructive">{result.errorFrames.length}</p>
              </div>
            </div>

            {/* Anomaly type breakdown */}
            {Object.keys(result.anomalyTypeSummary).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Anomalias por Tipo</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(result.anomalyTypeSummary).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                    <Badge
                      key={type}
                      variant="outline"
                      className={`text-xs cursor-pointer ${ANOMALY_COLORS[type as AnomalyType]} ${filterType === type ? 'ring-2 ring-primary' : ''}`}
                      onClick={() => setFilterType(filterType === type ? 'ALL' : type as AnomalyType)}
                    >
                      {type}: {count}
                    </Badge>
                  ))}
                  {filterType !== 'ALL' && (
                    <Badge variant="outline" className="text-xs cursor-pointer" onClick={() => setFilterType('ALL')}>
                      Mostrar Todos
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Strategy summary */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Qual estratégia teve melhor resultado?</p>
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
                  Sem melhoria: {result.errorFrames.filter(ef => !ef.bestStrategy).length}
                </Badge>
              </div>
            </div>

            {/* Opcode error map */}
            {Object.keys(result.opcodeErrorMap).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Erros de Parsing por Opcode</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(result.opcodeErrorMap).sort((a, b) => b[1] - a[1]).map(([op, count]) => (
                    <Badge key={op} variant="outline" className="text-xs font-mono">
                      {op}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Unknown opcodes */}
            {result.unknownOpcodeMap && Object.keys(result.unknownOpcodeMap).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Opcodes Desconhecidos — Impacto por Bytes Perdidos</p>
                <div className="max-h-[300px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs w-24">Opcode</TableHead>
                        <TableHead className="text-xs w-24">Ocorrências</TableHead>
                        <TableHead className="text-xs w-32">Bytes Perdidos</TableHead>
                        <TableHead className="text-xs w-32">Média/Ocorrência</TableHead>
                        <TableHead className="text-xs">Severidade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(result.unknownOpcodeMap)
                        .sort((a, b) => b[1].totalBytesLost - a[1].totalBytesLost)
                        .map(([op, data]) => {
                          const avg = Math.round(data.totalBytesLost / data.count);
                          const severity = data.totalBytesLost > 10000 ? 'destructive' : data.totalBytesLost > 1000 ? 'default' : 'secondary';
                          return (
                            <TableRow key={op}>
                              <TableCell className="text-xs font-mono font-bold">{op}</TableCell>
                              <TableCell className="text-xs font-mono">{data.count.toLocaleString()}</TableCell>
                              <TableCell className="text-xs font-mono">{data.totalBytesLost.toLocaleString()}</TableCell>
                              <TableCell className="text-xs font-mono">{avg} B</TableCell>
                              <TableCell>
                                <Badge variant={severity} className="text-[10px]">
                                  {severity === 'destructive' ? '🔴 Alto' : severity === 'default' ? '🟡 Médio' : '🟢 Baixo'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Recommendation */}
            <div className="bg-primary/10 border border-primary/20 rounded p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-primary" />
                <p className="text-xs font-semibold text-primary">Recomendação</p>
              </div>
              <p className="text-sm text-foreground">{result.recommendation}</p>
            </div>
          </Card>

          {/* Error frames table */}
          {filteredFrames.length > 0 && (
            <Card className="p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Frames com Anomalia ({filteredFrames.length}{filterType !== 'ALL' ? ` — filtro: ${filterType}` : ''})
              </h2>
              <div className="max-h-[600px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs w-16">Frame</TableHead>
                      <TableHead className="text-xs w-20">Tempo</TableHead>
                      <TableHead className="text-xs w-16">Floor</TableHead>
                      <TableHead className="text-xs">Anomalias</TableHead>
                      <TableHead className="text-xs w-16">Bytes</TableHead>
                      <TableHead className="text-xs w-24">Melhor</TableHead>
                      <TableHead className="text-xs w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFrames.slice(0, 200).map(ef => (
                      <ErrorFrameRow key={ef.frameIndex} ef={ef} />
                    ))}
                  </TableBody>
                </Table>
                {filteredFrames.length > 200 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Mostrando 200 de {filteredFrames.length} frames
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
