import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldAlert } from "lucide-react";

const DELETE_PASSWORD = "avatarhood";

interface DeleteConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  description: string;
}

export function DeleteConfirmModal({ open, onClose, onConfirm, description }: DeleteConfirmModalProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== DELETE_PASSWORD) {
      setError(true);
      setPassword("");
      return;
    }
    setLoading(true);
    try {
      await onConfirm();
      setPassword("");
      setError(false);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPassword("");
    setError(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <DialogTitle>Confirm Deletion</DialogTitle>
          </div>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="delete-pw">Deletion password</Label>
            <Input
              id="delete-pw"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false); }}
              placeholder="••••••••••"
              autoFocus
              className={error ? "border-destructive" : ""}
            />
            {error && <p className="text-xs text-destructive">Wrong password.</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" variant="destructive" disabled={loading || !password}>
              {loading ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
