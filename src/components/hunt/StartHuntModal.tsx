import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface StartHuntModalProps {
  open: boolean;
  onClose: () => void;
  onStart: (playerName: string) => Promise<void>;
  spotName: string;
  cityName: string;
  characterName?: string;
  isAdmin?: boolean;
}

export function StartHuntModal({ open, onClose, onStart, spotName, cityName, characterName = "", isAdmin = false }: StartHuntModalProps) {
  const [playerName, setPlayerName] = useState(characterName);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Sync playerName when modal opens or characterName changes
  useEffect(() => {
    if (open) setPlayerName(characterName);
  }, [open, characterName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    setLoading(true);
    try {
      await onStart(playerName.trim());
      toast({ title: "Hunt started!", description: `${playerName} at ${spotName}` });
      onClose();
    } catch {
      toast({ title: "Error", description: "Could not start the hunt.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start Hunt</DialogTitle>
          <DialogDescription>
            {spotName} — {cityName}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="player-name">Player Nick</Label>
            <Input
              id="player-name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter nick..."
              autoFocus
              readOnly={!isAdmin}
              className={!isAdmin ? "bg-muted cursor-default" : ""}
            />
            {!isAdmin && (
              <p className="text-xs text-muted-foreground">Starting hunt as your registered character.</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading || !playerName.trim()}>
              {loading ? "Starting..." : "🏹 Start Hunt"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
