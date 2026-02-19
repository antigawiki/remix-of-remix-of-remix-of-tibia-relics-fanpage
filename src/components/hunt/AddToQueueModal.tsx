import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface AddToQueueModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (playerName: string) => Promise<void>;
  spotName: string;
  cityName: string;
}

export function AddToQueueModal({ open, onClose, onAdd, spotName, cityName }: AddToQueueModalProps) {
  const [playerName, setPlayerName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    setLoading(true);
    try {
      await onAdd(playerName.trim());
      toast({ title: "Adicionado à fila!", description: `${playerName} entrou na fila de ${spotName}` });
      setPlayerName("");
      onClose();
    } catch {
      toast({ title: "Erro", description: "Não foi possível adicionar à fila.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Entrar na Fila de Espera</DialogTitle>
          <DialogDescription>
            {spotName} — {cityName}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="queue-player-name">Nick do Player</Label>
            <Input
              id="queue-player-name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Digite o nick..."
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading || !playerName.trim()}>
              {loading ? "Adicionando..." : "⏳ Entrar na Fila"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
