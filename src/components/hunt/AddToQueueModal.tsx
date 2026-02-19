import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Info } from "lucide-react";

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
      toast({ title: "Joined queue!", description: `You joined the queue for ${spotName}` });
      setPlayerName("");
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not join the queue.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Join Wait Queue</DialogTitle>
          <DialogDescription>
            {spotName} — {cityName}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>You can only be in one queue at a time. Enter your own character nick — notifications will appear only on your browser.</span>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="queue-player-name">Your Character Nick</Label>
            <Input
              id="queue-player-name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your nick..."
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading || !playerName.trim()}>
              {loading ? "Joining..." : "⏳ Join Queue"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
