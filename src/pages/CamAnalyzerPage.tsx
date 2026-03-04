import { useState, useRef, useCallback } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Upload, Play, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, ReferenceDot } from 'recharts';
import { DatLoader } from '@/lib/tibiaRelic/datLoader';
import { analyzeCamFile, type AnalysisResult, type Anomaly, type FrameDetail } from '@/lib/tibiaRelic/camAnalyzer';
import ProtocolLabTab from '@/components/cam-analyzer/ProtocolLabTab';
import ProtocolDiagnosticTab from '@/components/cam-analyzer/ProtocolDiagnosticTab';

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function CamAnalyzerPage() {
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const [selectedFrameIdx, setSelectedFrameIdx] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const datRef = useRef<DatLoader | null>(null);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setSelectedAnomaly(null);
    file.arrayBuffer().then(buf => setFileBuffer(buf));
  }, []);

  const loadDat = useCallback(async () => {
    if (!datRef.current) {
      const datResp = await fetch('/tibiarc/data/Tibia.dat');
      const datBuf = await datResp.arrayBuffer();
      const dat = new DatLoader();
      dat.load(datBuf);
      datRef.current = dat;
    }
    return datRef.current;
  }, []);

  const runAnalysis = useCallback(async () => {
    if (!fileBuffer) return;
    setAnalyzing(true);
    setResult(null);
    setSelectedAnomaly(null);

    try {
      const dat = await loadDat();
      const res = await analyzeCamFile(fileBuffer, dat, (cur, total) => {
        setProgress({ current: cur, total });
      });
      setResult(res);
    } catch (err) {
      console.error('Analysis failed:', err);
    } finally {
      setAnalyzing(false);
    }
  }, [fileBuffer, loadDat]);

  const exportJSON = useCallback(() => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.replace('.cam', '')}-analysis.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result, fileName]);

  const filteredAnomalies = result?.anomalies.filter(a => filterType === 'all' || a.type === filterType) ?? [];

  const getAdjacentFrames = (frameIndex: number): FrameDetail[] => {
    if (!result) return [];
    const start = Math.max(0, frameIndex - 2);
    const end = Math.min(result.frameDetails.length - 1, frameIndex + 2);
    return result.frameDetails.slice(start, end + 1);
  };

  const chartData = result ? (() => {
    const tl = result.positionTimeline;
    if (tl.length <= 2000) return tl;
    const step = Math.ceil(tl.length / 2000);
    return tl.filter((_, i) => i % step === 0);
  })() : [];

  const anomalyDots = result?.anomalies.map(a => {
    const point = result.positionTimeline[a.frameIndex];
    return point ? { ms: point.ms, camX: point.camX, camY: point.camY, type: a.type } : null;
  }).filter(Boolean) ?? [];

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Cam Packet Analyzer</h1>
        <p className="text-muted-foreground text-sm">
          Análise offline completa de arquivos .cam — detecta saltos de posição, trocas de andar e desyncs.
        </p>

        {/* Upload */}
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="cursor-pointer">
              <input type="file" accept=".cam" onChange={handleFileUpload} className="hidden" />
              <Button variant="outline" asChild>
                <span><Upload className="w-4 h-4 mr-2" />Selecionar .cam</span>
              </Button>
            </label>
            {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
          </div>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="analyzer" className="space-y-4">
          <TabsList>
            <TabsTrigger value="analyzer">Análise</TabsTrigger>
            <TabsTrigger value="protocol-diag">Protocol Diagnostic</TabsTrigger>
            <TabsTrigger value="protocol-lab">Protocol Lab</TabsTrigger>
          </TabsList>

          <TabsContent value="analyzer" className="space-y-4">
            {/* Analyzer controls */}
            <Card className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <Button onClick={runAnalysis} disabled={!fileBuffer || analyzing}>
                  <Play className="w-4 h-4 mr-2" />{analyzing ? 'Analisando...' : 'Analisar'}
                </Button>
                {result && (
                  <Button variant="outline" onClick={exportJSON}>
                    <Download className="w-4 h-4 mr-2" />Exportar JSON
                  </Button>
                )}
              </div>
              {analyzing && (
                <div className="space-y-1">
                  <Progress value={progress.total ? (progress.current / progress.total) * 100 : 0} />
                  <p className="text-xs text-muted-foreground">
                    Frame {progress.current.toLocaleString()} / {progress.total.toLocaleString()}
                  </p>
                </div>
              )}
            </Card>

            {result && (
              <>
                {/* Summary */}
                <Card className="p-4">
                  <div className="flex flex-wrap gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Frames</p>
                      <p className="text-lg font-bold text-foreground">{result.totalFrames.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Duração</p>
                      <p className="text-lg font-bold text-foreground">{formatMs(result.totalMs)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Anomalias</p>
                      <p className="text-lg font-bold text-destructive">{result.anomalies.length}</p>
                    </div>
                    <div className="flex flex-wrap gap-1 items-center">
                      {['POSITION_JUMP', 'FLOOR_JUMP', 'DESYNC'].map(t => {
                        const count = result.anomalies.filter(a => a.type === t).length;
                        if (!count) return null;
                        return (
                          <Badge key={t} variant={t === 'DESYNC' ? 'destructive' : 'secondary'} className="text-xs">
                            {t}: {count}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                </Card>

                {/* Charts */}
                <Card className="p-4">
                  <h2 className="text-sm font-semibold text-foreground mb-2">Position Timeline (Camera X, Y)</h2>
                  <div className="h-[250px] w-full">
                    <ChartContainer config={{
                      camX: { label: 'Cam X', color: 'hsl(var(--primary))' },
                      camY: { label: 'Cam Y', color: 'hsl(var(--accent))' },
                    }}>
                      <LineChart data={chartData}>
                        <XAxis dataKey="ms" tickFormatter={formatMs} tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line type="monotone" dataKey="camX" stroke="var(--color-camX)" dot={false} strokeWidth={1} />
                        <Line type="monotone" dataKey="camY" stroke="var(--color-camY)" dot={false} strokeWidth={1} />
                        {anomalyDots.map((d: any, i: number) => (
                          <ReferenceDot key={i} x={d.ms} y={d.camX} r={3} fill="hsl(var(--destructive))" stroke="none" />
                        ))}
                      </LineChart>
                    </ChartContainer>
                  </div>
                </Card>

                <Card className="p-4">
                  <h2 className="text-sm font-semibold text-foreground mb-2">Floor (Z) Timeline</h2>
                  <div className="h-[120px] w-full">
                    <ChartContainer config={{
                      camZ: { label: 'Floor Z', color: 'hsl(var(--primary))' },
                    }}>
                      <LineChart data={chartData}>
                        <XAxis dataKey="ms" tickFormatter={formatMs} tick={{ fontSize: 10 }} />
                        <YAxis domain={[0, 15]} tick={{ fontSize: 10 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line type="stepAfter" dataKey="camZ" stroke="var(--color-camZ)" dot={false} strokeWidth={1.5} />
                      </LineChart>
                    </ChartContainer>
                  </div>
                </Card>

                {/* Anomaly Table */}
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <h2 className="text-sm font-semibold text-foreground">Anomalias</h2>
                    <div className="flex gap-1">
                      {['all', 'POSITION_JUMP', 'FLOOR_JUMP', 'DESYNC'].map(t => (
                        <Button key={t} size="sm" variant={filterType === t ? 'default' : 'outline'} onClick={() => setFilterType(t)} className="text-xs h-6 px-2">
                          {t === 'all' ? 'Todos' : t}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="max-h-[400px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Frame</TableHead>
                          <TableHead className="w-20">Tempo</TableHead>
                          <TableHead className="w-28">Tipo</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="w-24">Opcodes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAnomalies.slice(0, 500).map((a, i) => (
                          <TableRow key={i} className="cursor-pointer hover:bg-accent/50" onClick={() => { setSelectedAnomaly(a); setSelectedFrameIdx(a.frameIndex); }}>
                            <TableCell className="text-xs font-mono">{a.frameIndex}</TableCell>
                            <TableCell className="text-xs">{formatMs(a.timestamp)}</TableCell>
                            <TableCell>
                              <Badge variant={a.type === 'DESYNC' ? 'destructive' : a.type === 'FLOOR_JUMP' ? 'default' : 'secondary'} className="text-xs">{a.type}</Badge>
                            </TableCell>
                            <TableCell className="text-xs max-w-[400px] truncate">{a.description}</TableCell>
                            <TableCell className="text-xs font-mono">{a.opcodes.map(o => '0x' + o.toString(16).toUpperCase()).join(', ')}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {filteredAnomalies.length > 500 && (
                      <p className="text-xs text-muted-foreground mt-2">Mostrando 500 de {filteredAnomalies.length} anomalias</p>
                    )}
                  </div>
                </Card>

                {/* Frame Detail Panel */}
                {selectedAnomaly && selectedFrameIdx !== null && (
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-sm font-semibold text-foreground">
                        Detalhes — Frame {selectedFrameIdx} ({formatMs(selectedAnomaly.timestamp)})
                      </h2>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => {
                          const idx = filteredAnomalies.findIndex(a => a.frameIndex === selectedAnomaly.frameIndex);
                          if (idx > 0) { setSelectedAnomaly(filteredAnomalies[idx - 1]); setSelectedFrameIdx(filteredAnomalies[idx - 1].frameIndex); }
                        }}>
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          const idx = filteredAnomalies.findIndex(a => a.frameIndex === selectedAnomaly.frameIndex);
                          if (idx < filteredAnomalies.length - 1) { setSelectedAnomaly(filteredAnomalies[idx + 1]); setSelectedFrameIdx(filteredAnomalies[idx + 1].frameIndex); }
                        }}>
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-muted rounded p-3">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">ANTES</p>
                        <p className="text-xs font-mono">Cam: ({selectedAnomaly.before.camX}, {selectedAnomaly.before.camY}, {selectedAnomaly.before.camZ})</p>
                        <p className="text-xs font-mono">Player: ({selectedAnomaly.before.playerX}, {selectedAnomaly.before.playerY}, {selectedAnomaly.before.playerZ})</p>
                      </div>
                      <div className="bg-muted rounded p-3">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">DEPOIS</p>
                        <p className="text-xs font-mono">Cam: ({selectedAnomaly.after.camX}, {selectedAnomaly.after.camY}, {selectedAnomaly.after.camZ})</p>
                        <p className="text-xs font-mono">Player: ({selectedAnomaly.after.playerX}, {selectedAnomaly.after.playerY}, {selectedAnomaly.after.playerZ})</p>
                      </div>
                    </div>
                    <h3 className="text-xs font-semibold text-muted-foreground mb-2">Frames adjacentes (±2)</h3>
                    <div className="overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">Frame</TableHead>
                            <TableHead className="w-20">Tempo</TableHead>
                            <TableHead className="w-32">Opcodes</TableHead>
                            <TableHead>Posição após</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getAdjacentFrames(selectedFrameIdx).map(fd => (
                            <TableRow key={fd.frameIndex} className={fd.frameIndex === selectedFrameIdx ? 'bg-destructive/10' : ''}>
                              <TableCell className="text-xs font-mono">{fd.frameIndex}</TableCell>
                              <TableCell className="text-xs">{formatMs(fd.timestamp)}</TableCell>
                              <TableCell className="text-xs font-mono">{fd.opcodes.map(o => '0x' + o.toString(16).toUpperCase()).join(', ')}</TableCell>
                              <TableCell className="text-xs font-mono">
                                cam({fd.posAfter.camX},{fd.posAfter.camY},{fd.posAfter.camZ}) player({fd.posAfter.playerX},{fd.posAfter.playerY},{fd.posAfter.playerZ})
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="protocol-diag">
            <ProtocolDiagnosticTab fileBuffer={fileBuffer} fileName={fileName} loadDat={loadDat} />
          </TabsContent>

          <TabsContent value="protocol-lab">
            <ProtocolLabTab fileBuffer={fileBuffer} fileName={fileName} loadDat={loadDat} />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
