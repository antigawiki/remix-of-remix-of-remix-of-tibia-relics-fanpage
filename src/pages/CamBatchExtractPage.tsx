import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Upload, Loader2, CheckCircle2, XCircle, FileIcon, Trash2, Map } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSelector } from '@/components/LanguageSelector';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { parseCamFile, type CamFile } from '@/lib/tibiaRelic/camParser';
import { DatLoader } from '@/lib/tibiaRelic/datLoader';
import { extractMapTiles, type MapExtractionProgress } from '@/lib/tibiaRelic/mapExtractor';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FileEntry {
  file: File;
  status: 'pending' | 'extracting' | 'uploading' | 'done' | 'error';
  progress: number; // 0-100
  tiles: number;
  creatures: number;
  error?: string;
}

const TILE_RPC_BATCH = 500;
const SPAWN_RPC_BATCH = 500;

const CamBatchExtractPage = () => {
  const [datLoader, setDatLoader] = useState<DatLoader | null>(null);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [processing, setProcessing] = useState(false);
  const [compactStatus, setCompactStatus] = useState('');
  const [currentIdx, setCurrentIdx] = useState(-1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  // Load dat on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const datRes = await fetch('/tibiarc/data/Tibia.dat');
        if (!datRes.ok) throw new Error('Tibia.dat not found');
        const datBuf = await datRes.arrayBuffer();
        if (cancelled) return;
        const dat = new DatLoader();
        dat.load(datBuf);
        setDatLoader(dat);
        setAssetsLoading(false);
      } catch (err) {
        console.error('[BatchExtract] Failed to load dat:', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleFilesSelected = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    const newEntries: FileEntry[] = Array.from(selectedFiles)
      .filter(f => f.name.toLowerCase().endsWith('.cam'))
      .map(f => ({
        file: f,
        status: 'pending' as const,
        progress: 0,
        tiles: 0,
        creatures: 0,
      }));
    setFiles(prev => [...prev, ...newEntries]);
  }, []);

  const processAll = useCallback(async () => {
    if (!datLoader || files.length === 0) return;
    setProcessing(true);
    abortRef.current = false;

    for (let i = 0; i < files.length; i++) {
      if (abortRef.current) break;
      if (files[i].status === 'done') continue;

      setCurrentIdx(i);

      // Update status to extracting
      setFiles(prev => prev.map((f, idx) =>
        idx === i ? { ...f, status: 'extracting', progress: 0, error: undefined } : f
      ));

      try {
        // Parse .cam
        const buffer = await files[i].file.arrayBuffer();
        const cam = parseCamFile(buffer);

        if (cam.frames.length === 0) {
          setFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, status: 'error', error: 'Empty .cam file' } : f
          ));
          continue;
        }

        // Extract tiles & creatures
        const result = await extractMapTiles(cam, datLoader, (p: MapExtractionProgress) => {
          setFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, progress: p.percent, tiles: p.tilesExtracted } : f
          ));
        });

        if (abortRef.current) break;

        // Upload phase - individual tiles via batch RPC
        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: 'uploading', progress: 0, tiles: result.tiles.size, creatures: result.spawns.length } : f
        ));

        // Upload tiles via batch RPC (many tiles per single HTTP call)
        const tileEntries = Array.from(result.tiles.entries());
        const totalSteps = Math.ceil(tileEntries.length / TILE_RPC_BATCH) + Math.ceil(result.spawns.length / SPAWN_RPC_BATCH);
        let stepsDone = 0;

        for (let j = 0; j < tileEntries.length; j += TILE_RPC_BATCH) {
          if (abortRef.current) break;
          const batch = tileEntries.slice(j, j + TILE_RPC_BATCH).map(([key, items]) => {
            const [x, y, z] = key.split(',').map(Number);
            return { x, y, z, items };
          });
          await supabase.rpc('merge_cam_tiles_batch' as any, { tiles: batch });
          stepsDone++;
          setFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, progress: Math.round((stepsDone / totalSteps) * 100) } : f
          ));
        }

        // Upload spawns via batch RPC
        for (let j = 0; j < result.spawns.length; j += SPAWN_RPC_BATCH) {
          if (abortRef.current) break;
          const batch = result.spawns.slice(j, j + SPAWN_RPC_BATCH).map(s => ({
            px: s.chunkX, py: s.chunkY, pz: s.z,
            creature_name: s.creatureName,
            outfit_id: s.outfitId,
            avg_count: s.avgCount,
            positions: s.positions,
            visit_count: s.visitCount,
          }));
          await supabase.rpc('merge_cam_spawns_batch' as any, { spawns: batch });
          stepsDone++;
          setFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, progress: Math.round((stepsDone / totalSteps) * 100) } : f
          ));
        }

        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: 'done', progress: 100 } : f
        ));

        console.log(`[BatchExtract] ${files[i].file.name}: ${result.tiles.size} tiles, ${result.spawns.length} spawns`);

        // Small delay between files to let GC run
        await new Promise(r => setTimeout(r, 100));

      } catch (err) {
        console.error(`[BatchExtract] Error processing ${files[i].file.name}:`, err);
        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: 'error', error: err instanceof Error ? err.message : 'Unknown error' } : f
        ));
      }
    }

    // Auto-compact removed — user triggers "Gerar Mapa" manually

    setProcessing(false);
    setCurrentIdx(-1);
  }, [datLoader, files]);

  const clearFiles = () => {
    if (processing) {
      abortRef.current = true;
      return;
    }
    setFiles([]);
  };

  const [generating, setGenerating] = useState(false);
  const [clearing, setClearing] = useState(false);

  const clearDatabase = async () => {
    setClearing(true);
    try {
      const { error } = await supabase.rpc('clear_cam_map_data' as any);
      if (error) throw error;
      toast.success('Tabelas limpas com sucesso!');
    } catch (err) {
      toast.error('Erro ao limpar tabelas');
      console.error(err);
    } finally {
      setClearing(false);
    }
  };

  const CHUNK_BATCH = 200;
  const PAGE_SIZE = 1000;

  const generateMap = async () => {
    setGenerating(true);
    const failedFloors: number[] = [];
    let totalChunks = 0;

    try {
      for (let z = 0; z <= 15; z++) {
        if (abortRef.current) break;

        // Phase 1: Read all tiles for this floor (paginated)
        setCompactStatus(`Andar ${z} — lendo tiles...`);
        const chunkMap: Record<string, Record<string, unknown>> = {};
        let offset = 0;
        let tilesRead = 0;

        while (true) {
          if (abortRef.current) break;
          const { data, error } = await supabase
            .from('cam_map_tiles')
            .select('x, y, items')
            .eq('z', z)
            .range(offset, offset + PAGE_SIZE - 1);

          if (error) {
            console.error(`[Compact] Floor ${z} read error:`, error);
            failedFloors.push(z);
            break;
          }
          if (!data || data.length === 0) break;

          for (const tile of data) {
            const cx = Math.floor(tile.x / 8);
            const cy = Math.floor(tile.y / 8);
            const key = `${cx},${cy}`;
            const relKey = `${tile.x - cx * 8},${tile.y - cy * 8}`;
            if (!chunkMap[key]) chunkMap[key] = {};
            chunkMap[key][relKey] = tile.items;
          }

          tilesRead += data.length;
          setCompactStatus(`Andar ${z} — ${tilesRead.toLocaleString()} tiles lidos...`);
          offset += PAGE_SIZE;

          if (data.length < PAGE_SIZE) break;
        }

        const keys = Object.keys(chunkMap);
        if (keys.length === 0) {
          console.log(`[Compact] Floor ${z}: no tiles, skipping`);
          continue;
        }

        // Phase 2: Upload chunks via merge_cam_chunks_batch
        const entries = keys.map(k => [k, chunkMap[k]] as [string, Record<string, unknown>]);
        const totalBatches = Math.ceil(entries.length / CHUNK_BATCH);

        for (let j = 0; j < entries.length; j += CHUNK_BATCH) {
          if (abortRef.current) break;
          const batchNum = Math.floor(j / CHUNK_BATCH) + 1;
          setCompactStatus(`Andar ${z} — salvando chunks ${batchNum}/${totalBatches}`);

          const batch = entries.slice(j, j + CHUNK_BATCH).map(([k, data]) => {
            const [cx, cy] = (k as string).split(',').map(Number);
            return { cx, cy, z, data };
          });

          const { error } = await supabase.rpc('merge_cam_chunks_batch' as any, { chunks: batch });
          if (error) {
            console.error(`[Compact] Floor ${z} chunk upload error:`, error);
            failedFloors.push(z);
            break;
          }
          totalChunks += batch.length;
        }

        if (!failedFloors.includes(z)) {
          console.log(`[Compact] Floor ${z}: ${entries.length} chunks from ${tilesRead} tiles`);
        }
      }

      if (failedFloors.length > 0) {
        toast.error(`Mapa gerado parcialmente. Andares com erro: ${failedFloors.join(', ')}. Tente novamente.`);
      } else {
        toast.success(`Mapa gerado! ${totalChunks} chunks criados/atualizados.`);
      }
    } catch (err) {
      console.error('[Compact] Error:', err);
      toast.error('Erro ao gerar mapa');
    } finally {
      setCompactStatus('');
      setGenerating(false);
    }
  };

  const totalDone = files.filter(f => f.status === 'done').length;
  const totalErrors = files.filter(f => f.status === 'error').length;
  const totalTiles = files.reduce((s, f) => s + f.tiles, 0);
  const totalCreatures = files.reduce((s, f) => s + f.creatures, 0);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="bg-card border-b border-border/50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/b7d3e1a9f5c2" className="text-gold hover:text-gold/80 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-gold" />
            <h1 className="font-heading text-lg text-gold">Batch Extract .cam</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={generateMap}
            disabled={processing || generating || clearing}
            className="bg-gold text-gold-foreground hover:bg-gold/90"
          >
            {generating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Map className="w-3 h-3 mr-1" />}
            Gerar Mapa
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={processing || clearing}>
                {clearing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Trash2 className="w-3 h-3 mr-1" />}
                Limpar DB
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar todas as tabelas do mapa?</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso apagará todos os dados de chunks, spawns, tiles e criaturas extraídos. Você precisará re-subir as .cam para popular o mapa novamente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={clearDatabase} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Confirmar Limpeza
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <LanguageSelector />
          <ThemeToggle />
        </div>
      </div>

      <div className="flex-1 p-6 max-w-3xl mx-auto w-full space-y-6">
        {assetsLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-gold animate-spin" />
            <span className="ml-3 text-muted-foreground">Carregando definições...</span>
          </div>
        ) : (
          <>
            {/* Upload area */}
            <div
              className="border-2 border-dashed border-border/50 rounded-sm p-8 text-center cursor-pointer hover:border-gold/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDrop={(e) => { e.preventDefault(); handleFilesSelected(e.dataTransfer.files); }}
              onDragOver={(e) => e.preventDefault()}
            >
              <Upload className="w-10 h-10 text-gold/60 mx-auto mb-3" />
              <p className="text-gold font-heading">Arraste ou clique para selecionar .cam files</p>
              <p className="text-xs text-muted-foreground mt-1">Selecione múltiplos arquivos de uma vez</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".cam"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleFilesSelected(e.target.files);
                  if (e.target) e.target.value = '';
                }}
              />
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {files.length} arquivo(s) • {totalDone} concluído(s)
                    {totalErrors > 0 && ` • ${totalErrors} erro(s)`}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearFiles}
                      className="border-border/50"
                    >
                      {processing ? 'Parar' : 'Limpar'}
                    </Button>
                    <Button
                      size="sm"
                      onClick={processAll}
                      disabled={processing || files.every(f => f.status === 'done')}
                      className="bg-gold text-gold-foreground hover:bg-gold/90"
                    >
                      {processing ? (
                        <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processando...</>
                      ) : (
                        '🗺️ Extrair Todos'
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {files.map((entry, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-3 bg-card border border-border/30 rounded-sm px-3 py-2 ${
                        idx === currentIdx ? 'ring-1 ring-gold/50' : ''
                      }`}
                    >
                      <div className="flex-shrink-0">
                        {entry.status === 'done' && <CheckCircle2 className="w-4 h-4 text-gold" />}
                        {entry.status === 'error' && <XCircle className="w-4 h-4 text-destructive" />}
                        {entry.status === 'pending' && <FileIcon className="w-4 h-4 text-muted-foreground" />}
                        {(entry.status === 'extracting' || entry.status === 'uploading') && (
                          <Loader2 className="w-4 h-4 text-gold animate-spin" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{entry.file.name}</p>
                        {entry.status === 'extracting' && (
                          <div className="flex items-center gap-2 mt-1">
                            <Progress value={entry.progress} className="h-1.5 flex-1" />
                            <span className="text-xs text-muted-foreground">{entry.progress}% extraindo</span>
                          </div>
                        )}
                        {entry.status === 'uploading' && (
                          <div className="flex items-center gap-2 mt-1">
                            <Progress value={entry.progress} className="h-1.5 flex-1" />
                            <span className="text-xs text-muted-foreground">{entry.progress}% enviando</span>
                          </div>
                        )}
                        {entry.status === 'done' && (
                          <p className="text-xs text-muted-foreground">{entry.tiles} tiles, {entry.creatures} criaturas</p>
                        )}
                        {entry.status === 'error' && (
                          <p className="text-xs text-destructive">{entry.error}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {(entry.file.size / 1024 / 1024).toFixed(1)} MB
                      </span>
                    </div>
                  ))}
                </div>

                {/* Compact status */}
                {compactStatus && (
                  <div className="bg-card border border-border/30 rounded-sm p-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 text-gold animate-spin" />
                      <span className="text-sm text-muted-foreground">{compactStatus}</span>
                    </div>
                  </div>
                )}

                {/* Summary */}
                {totalDone > 0 && !processing && !compactStatus && (
                  <div className="bg-card border border-border/30 rounded-sm p-3 text-center">
                    <p className="text-sm text-gold font-heading">
                      ✅ {totalDone} arquivo(s) extraído(s) — {totalTiles.toLocaleString()} tiles, {totalCreatures.toLocaleString()} criaturas
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Dados salvos e compactados. Acesse o <Link to="/b7d3e1a9f5c2" className="text-gold underline">Cam Map</Link> para visualizar.
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CamBatchExtractPage;
