import { useState } from 'react';
import { X, Plus, Trash2, Save, Replace } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { MapTileRenderer } from '@/lib/tibiaRelic/mapTileRenderer';
import type { TileData } from '@/lib/tibiaRelic/mapTileRenderer';

interface TileEditPanelProps {
  tile: { x: number; y: number; z: number; items: number[] };
  renderer: MapTileRenderer;
  selectedItemId: number | null;
  onClose: () => void;
  onSaved: (x: number, y: number, z: number, newItems: number[]) => void;
}

export const TileEditPanel = ({ tile, renderer, selectedItemId, onClose, onSaved }: TileEditPanelProps) => {
  const [items, setItems] = useState<number[]>([...tile.items]);
  const [saving, setSaving] = useState(false);

  const renderSprite = (el: HTMLCanvasElement | null, itemId: number) => {
    if (!el) return;
    const rendered = renderer.renderSingleSprite(itemId);
    if (rendered) {
      const ctx = el.getContext('2d')!;
      ctx.clearRect(0, 0, 32, 32);
      ctx.drawImage(rendered, 0, 0);
    }
  };

  const addItem = () => {
    if (!selectedItemId) { toast.error('Selecione um sprite na sidebar'); return; }
    setItems(prev => [...prev, selectedItemId]);
  };

  const replaceAll = () => {
    if (!selectedItemId) { toast.error('Selecione um sprite na sidebar'); return; }
    setItems([selectedItemId]);
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const save = async () => {
    setSaving(true);
    try {
      // Upsert to cam_map_tiles with seen_count=999 (manual edit protection)
      const { error } = await supabase
        .from('cam_map_tiles')
        .upsert({
          x: tile.x,
          y: tile.y,
          z: tile.z,
          items: items as any,
          seen_count: 999,
        } as any);
      if (error) throw error;

      // Update the chunk in cam_map_chunks
      const cx = Math.floor(tile.x / 8);
      const cy = Math.floor(tile.y / 8);
      const relX = tile.x - cx * 8;
      const relY = tile.y - cy * 8;
      const relKey = `${relX},${relY}`;

      // Fetch current chunk
      const { data: chunkData } = await supabase
        .from('cam_map_chunks')
        .select('tiles_data')
        .eq('chunk_x', cx)
        .eq('chunk_y', cy)
        .eq('z', tile.z)
        .maybeSingle();

      const tilesData = (chunkData?.tiles_data || {}) as Record<string, number[]>;
      tilesData[relKey] = items;

      await supabase
        .from('cam_map_chunks')
        .upsert({
          chunk_x: cx,
          chunk_y: cy,
          z: tile.z,
          tiles_data: tilesData as any,
        } as any);

      onSaved(tile.x, tile.y, tile.z, items);
      toast.success(`Tile (${tile.x}, ${tile.y}) salvo`);
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="absolute bottom-16 left-4 z-[1001] bg-card border border-border/50 rounded-sm shadow-lg w-72">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <span className="text-xs font-bold text-gold">
          Tile ({tile.x}, {tile.y}, {tile.z})
        </span>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onClose}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Items list */}
      <div className="p-2 max-h-48 overflow-y-auto">
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">Nenhum item</p>
        )}
        {items.map((itemId, idx) => (
          <div key={`${itemId}-${idx}`} className="flex items-center gap-2 py-0.5">
            <canvas
              width={32}
              height={32}
              className="pixelated border border-border/30 rounded"
              style={{ imageRendering: 'pixelated', width: 24, height: 24 }}
              ref={el => renderSprite(el, itemId)}
            />
            <span className="text-xs text-muted-foreground flex-1">ID: {itemId}</span>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeItem(idx)}>
              <Trash2 className="w-3 h-3 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 p-2 border-t border-border/50">
        <Button variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={addItem} disabled={!selectedItemId}>
          <Plus className="w-3 h-3 mr-1" /> Adicionar
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={replaceAll} disabled={!selectedItemId}>
          <Replace className="w-3 h-3 mr-1" /> Substituir
        </Button>
      </div>
      <div className="px-2 pb-2">
        <Button size="sm" className="h-7 text-xs w-full bg-gold hover:bg-gold/90 text-black" onClick={save} disabled={saving}>
          <Save className="w-3 h-3 mr-1" /> {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </div>
  );
};
