import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { HuntCity } from "@/hooks/useHuntAdmin";

interface AddSpotModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (cityId: string, name: string, maxDuration: number) => Promise<void>;
  cities: HuntCity[];
  preselectedCityId?: string;
}

export function AddSpotModal({ open, onClose, onAdd, cities, preselectedCityId }: AddSpotModalProps) {
  const [name, setName] = useState("");
  const [cityId, setCityId] = useState(preselectedCityId || "");
  const [maxDuration, setMaxDuration] = useState(240);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !cityId) return;
    setLoading(true);
    try {
      await onAdd(cityId, name.trim(), maxDuration);
      toast({ title: "Spot adicionado!", description: name });
      setName("");
      onClose();
    } catch {
      toast({ title: "Erro", description: "Não foi possível adicionar o spot.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Spot de Hunt</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="spot-city">Cidade</Label>
            <select
              id="spot-city"
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Selecione a cidade</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="spot-name">Nome do Spot</Label>
            <Input
              id="spot-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Hunters, Serpentine Tower..."
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="spot-duration">Duração Máxima (minutos)</Label>
            <Input
              id="spot-duration"
              type="number"
              value={maxDuration}
              onChange={(e) => setMaxDuration(Number(e.target.value))}
              min={30}
              max={480}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading || !name.trim() || !cityId}>
              {loading ? "Adicionando..." : "Adicionar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
