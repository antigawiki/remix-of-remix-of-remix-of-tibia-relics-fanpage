import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, UserPlus, CheckCircle, Clock } from "lucide-react";
import { HuntQueueItem } from "@/hooks/useHuntAdmin";
import { AddToQueueModal } from "./AddToQueueModal";

interface HuntQueuePanelProps {
  spotId: string;
  spotName: string;
  cityName: string;
  queue: HuntQueueItem[];
  onAdd: (spotId: string, playerName: string) => Promise<void>;
  onRemove: (queueId: string) => Promise<void>;
  onClaim: (queueId: string) => Promise<void>;
}

const statusLabel: Record<string, string> = {
  waiting: "Waiting",
  notified: "Notified",
  claimed: "Claimed",
  expired: "Expired",
};

const statusColor: Record<string, string> = {
  waiting: "secondary",
  notified: "default",
  claimed: "outline",
  expired: "destructive",
};

export function HuntQueuePanel({
  spotId,
  spotName,
  cityName,
  queue,
  onAdd,
  onRemove,
  onClaim,
}: HuntQueuePanelProps) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          Wait queue
        </span>
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
          <UserPlus className="h-3 w-3 mr-1" /> Add
        </Button>
      </div>

      {queue.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No players in queue.</p>
      ) : (
        <div className="space-y-1">
          {queue.map((item, idx) => (
            <div
              key={item.id}
              className="flex items-center justify-between bg-muted/40 rounded-md px-2 py-1.5 gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">
                  #{idx + 1}
                </span>
                <span className="text-sm font-medium truncate">{item.player_name}</span>
                <Badge
                  variant={statusColor[item.status] as "default" | "secondary" | "destructive" | "outline"}
                  className="text-xs shrink-0"
                >
                  {item.status === "notified" && <Clock className="h-2.5 w-2.5 mr-0.5" />}
                  {statusLabel[item.status]}
                </Badge>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {item.status === "notified" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-1.5 text-xs"
                    onClick={() => onClaim(item.id)}
                    title="Confirmar presença"
                  >
                    <CheckCircle className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  onClick={() => onRemove(item.id)}
                  title="Remove from queue"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddToQueueModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={(playerName) => onAdd(spotId, playerName)}
        spotName={spotName}
        cityName={cityName}
      />
    </div>
  );
}
