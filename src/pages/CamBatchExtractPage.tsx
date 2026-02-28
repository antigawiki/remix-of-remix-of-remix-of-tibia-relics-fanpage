import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Upload, Loader2, CheckCircle2, XCircle, FileIcon, Trash2 } from 'lucide-react';
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

const UPLOAD_BATCH = 200;

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

        // Upload phase - group tiles into 8x8 chunks and upload directly
        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: 'uploading', progress: 0, tiles: result.tiles.size, creatures: result.spawns.length } : f
        ));

        // Group tiles into 8x8 chunks
        const chunkMap = new Map<string, Record<string, number[]>>();
        for (const [key, items] of result.tiles.entries()) {
          const [x, y, z] = key.split(',').map(Number);
          const cx = Math.floor(x / 8);
          const cy = Math.floor(y / 8);
          const chunkKey = `${cx},${cy},${z}`;
          let chunkData = chunkMap.get(chunkKey);
          if (!chunkData) { chunkData = {}; chunkMap.set(chunkKey, chunkData); }
          const relX = x - cx * 8;
          const relY = y - cy * 8;
          chunkData[`${relX},${relY}`] = items;
        }

        // Upload chunks via merge_cam_chunk
        const chunkEntries = Array.from(chunkMap.entries());
        for (let j = 0; j < chunkEntries.length; j += UPLOAD_BATCH) {
          if (abortRef.current) break;
          const batch = chunkEntries.slice(j, j + UPLOAD_BATCH);
          await Promise.all(batch.map(([key, data]) => {
            const [cx, cy, z] = key.split(',').map(Number);
            return supabase.rpc('merge_cam_chunk' as any, { px: cx, py: cy, pz: z, new_data: data });
          }));
          const uploadPercent = Math.round(((j + UPLOAD_BATCH) / chunkEntries.length) * 100);
          setFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, progress: Math.min(uploadPercent, 100) } : f
          ));
        }

        // Upload spawns
        for (let j = 0; j < result.spawns.length; j += UPLOAD_BATCH) {
          if (abortRef.current) break;
          const batch = result.spawns.slice(j, j + UPLOAD_BATCH);
          await Promise.all(batch.map(s =>
            supabase.rpc('merge_cam_spawn' as any, {
              px: s.chunkX, py: s.chunkY, pz: s.z,
              p_creature_name: s.creatureName,
              p_outfit_id: s.outfitId,
              p_avg_count: s.avgCount,
              p_positions: s.positions,
              p_visit_count: s.visitCount,
            })
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

    // No compaction needed — chunks uploaded directly

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
