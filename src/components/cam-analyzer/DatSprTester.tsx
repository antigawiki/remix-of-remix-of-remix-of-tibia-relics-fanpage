import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { FlaskConical, Trophy, AlertTriangle, CheckCircle, Search } from 'lucide-react';
import { DatLoader } from '@/lib/tibiaRelic/datLoader';
import { validateDat, extractItemHexDumps, type ValidationReport, type BadItemInfo } from '@/lib/tibiaRelic/datValidator';

interface DatSprTesterProps {
  loadDat: () => Promise<DatLoader>;
  datBuffer?: ArrayBuffer | null;
}

export default function DatSprTester({ loadDat, datBuffer: externalDatBuffer }: DatSprTesterProps) {
  const [validating, setValidating] = useState(false);
  const [localDatBuffer, setLocalDatBuffer] = useState<ArrayBuffer | null>(null);

  // Auto-load the DAT buffer (it's a static file, not dependent on .cam)
  useEffect(() => {
    if (!externalDatBuffer && !localDatBuffer) {
      fetch('/tibiarc/data/Tibia.dat')
        .then(r => r.arrayBuffer())
        .then(buf => setLocalDatBuffer(buf))
        .catch(err => console.error('Failed to load Tibia.dat:', err));
    }
  }, [externalDatBuffer, localDatBuffer]);

  const datBuffer = externalDatBuffer ?? localDatBuffer;
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [hexStartId, setHexStartId] = useState(100);
  const [hexCount, setHexCount] = useState(10);
  const [hexDumps, setHexDumps] = useState<{ id: number; hex: string; byteCount: number }[] | null>(null);
  const [expandedBadItem, setExpandedBadItem] = useState<number | null>(null);

  const runValidation = useCallback(async () => {
    setValidating(true);
    setReport(null);
    try {
      // Load dat to get max sprite ID
      const dat = await loadDat();
      let maxSprId: number | null = null;
      for (const [, it] of dat.items) {
        for (const sid of it.spriteIds) {
          if (sid > (maxSprId ?? 0)) maxSprId = sid;
        }
      }

      // Get the raw buffer — we need it from the prop or re-fetch
      const buffer = datBuffer;
      if (!buffer) {
        console.error('No datBuffer available for validation');
        setValidating(false);
        return;
      }

      const result = validateDat(buffer, maxSprId);
      setReport(result);
    } catch (err) {
      console.error('Validation failed:', err);
    } finally {
      setValidating(false);
    }
  }, [loadDat, datBuffer]);

  const extractHex = useCallback(() => {
    if (!datBuffer) return;
    const dumps = extractItemHexDumps(datBuffer, hexStartId, hexCount);
    setHexDumps(dumps);
  }, [datBuffer, hexStartId, hexCount]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <FlaskConical className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">DAT/SPR Local Validator</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Testa 7 hipóteses de leitura do .dat direto no browser (sem IA). Compara flag payloads, sprite ID sizes e pontua cada abordagem.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Button onClick={runValidation} disabled={validating || !datBuffer}>
            <FlaskConical className="w-4 h-4 mr-2" />
            {validating ? 'Validando...' : 'Validar Localmente'}
          </Button>
          {!datBuffer && (
            <p className="text-xs text-muted-foreground">Carregando Tibia.dat...</p>
          )}
        </div>
      </Card>

      {/* Results Table */}
      {report && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" />
              Resultados — Vencedor: <Badge variant="default">{report.hypotheses[0]?.label}</Badge>
            </h3>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span>Sig: {report.datSignature}</span>
              <span>MaxID: {report.maxItemId}</span>
              <span>{(report.fileSize / 1024).toFixed(0)} KB</span>
            </div>
          </div>

          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Hipótese</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">Dims OK</TableHead>
                  <TableHead className="text-right">Dims ❌</TableHead>
                  <TableHead className="text-right">Refs ✓</TableHead>
                  <TableHead className="text-right">Spr OK</TableHead>
                  <TableHead className="text-right">Spr ❌</TableHead>
                  <TableHead className="text-right">Bytes Rest</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.hypotheses.map((h, idx) => (
                  <TableRow
                    key={h.name}
                    className={idx === 0 ? 'bg-primary/5' : ''}
                  >
                    <TableCell className="font-mono text-xs">
                      {idx === 0 ? <Trophy className="w-3 h-3 text-primary" /> : idx + 1}
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="text-xs font-semibold">{h.label}</span>
                        <p className="text-[10px] text-muted-foreground">{h.description}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={h.score >= 80 ? 'default' : h.score >= 50 ? 'secondary' : 'destructive'}>
                        {h.score}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-foreground">
                      {h.validDimensions}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-destructive">
                      {h.invalidDimensions}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      <span className={h.referenceMatches === 3 ? 'text-primary' : 'text-destructive'}>
                        {h.referenceMatches}/3
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-foreground">
                      {h.validSpriteIds.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-destructive">
                      {h.invalidSpriteIds.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      <span className={h.bytesRemaining === 0 ? 'text-primary' : 'text-destructive'}>
                        {h.bytesRemaining}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Reference Details */}
          <div className="mt-3 space-y-1">
            <h4 className="text-xs font-semibold text-muted-foreground">Referências (item→sprite[0])</h4>
            <div className="flex flex-wrap gap-2">
              {report.hypotheses[0]?.referenceDetails.map(ref => (
                <div key={ref.id} className={`text-[10px] font-mono px-2 py-1 rounded ${ref.match ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
                  {ref.match ? <CheckCircle className="w-3 h-3 inline mr-1" /> : <AlertTriangle className="w-3 h-3 inline mr-1" />}
                  #{ref.id}: esperado={ref.expected} got={ref.got}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Bad Items from winner */}
      {report && report.hypotheses[0]?.sampleBadItems.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            Items com Dimensões Inválidas ({report.hypotheses[0].label})
          </h3>
          <p className="text-xs text-muted-foreground mb-2">
            Primeiro item ruim: #{report.hypotheses[0].firstBadItem}. Mostrando primeiros {report.hypotheses[0].sampleBadItems.length} items problemáticos.
          </p>
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-1">
              {report.hypotheses[0].sampleBadItems.map((item: BadItemInfo) => (
                <div key={item.id}>
                  <div
                    className="text-[10px] font-mono px-2 py-1 rounded bg-destructive/10 flex items-center gap-2 cursor-pointer hover:bg-destructive/20"
                    onClick={() => setExpandedBadItem(expandedBadItem === item.id ? null : item.id)}
                  >
                    <span className="text-muted-foreground w-12">#{item.id}</span>
                    <span className="w-24">{item.w}x{item.h} L{item.layers}</span>
                    <span className="w-24">pat:{item.patX},{item.patY},{item.patZ}</span>
                    <span className="w-12">a:{item.anim}</span>
                    <span className="w-16">{item.sprCount}spr</span>
                    <span className="text-muted-foreground">spr0={item.spr0}</span>
                  </div>
                  {expandedBadItem === item.id && (
                    <div className="text-[9px] font-mono px-2 py-1 bg-muted/50 rounded-b break-all text-muted-foreground">
                      {item.hexContext}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>
      )}

      {/* Hex Dump Inspector */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Search className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Hex Dump Inspector</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Extrai os bytes brutos de um range de items do .dat para inspeção manual.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Item ID inicial</label>
            <Input
              type="number"
              value={hexStartId}
              onChange={e => setHexStartId(Number(e.target.value))}
              className="w-24"
              min={100}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Quantidade</label>
            <Input
              type="number"
              value={hexCount}
              onChange={e => setHexCount(Number(e.target.value))}
              className="w-24"
              min={1}
              max={50}
            />
          </div>
          <Button onClick={extractHex} disabled={!datBuffer} variant="outline">
            <Search className="w-4 h-4 mr-2" />
            Extrair Hex
          </Button>
        </div>

        {hexDumps && (
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {hexDumps.map(d => (
                <div key={d.id} className="text-[10px] font-mono">
                  <div className="flex items-center gap-2 text-muted-foreground mb-0.5">
                    <span className="font-semibold text-foreground">#{d.id}</span>
                    <span>{d.byteCount} bytes</span>
                  </div>
                  <div className="bg-muted/30 px-2 py-1 rounded break-all leading-relaxed">
                    {d.hex}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </Card>
    </div>
  );
}
