import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Plus, Trash2 } from "lucide-react";
import { HuntSpot, HuntSession, HuntQueueItem, HuntCity } from "@/hooks/useHuntAdmin";
import { HuntSpotCard } from "./HuntSpotCard";
import { AddSpotModal } from "./AddSpotModal";
import { DeleteConfirmModal } from "./DeleteConfirmModal";

interface HuntCityCardProps {
  city: HuntCity;
  spots: HuntSpot[];
  cities: HuntCity[];
  playerSessionId: string;
  characterName: string;
  myQueueSpotId: string | null;
  isAdmin: boolean;
  getSessionForSpot: (spotId: string) => HuntSession | undefined;
  getQueueForSpot: (spotId: string) => HuntQueueItem[];
  onStartHunt: (spotId: string, playerName: string) => Promise<void>;
  onEndHunt: (sessionId: string) => Promise<void>;
  onAddToQueue: (spotId: string, playerName: string, sessionId: string) => Promise<void>;
  onRemoveFromQueue: (queueId: string) => Promise<void>;
  onClaimSpot: (queueId: string) => Promise<void>;
  onAddSpot: (cityId: string, name: string, maxDuration: number) => Promise<void>;
  onDeleteSpot: (spotId: string) => Promise<void>;
  onDeleteCity: (cityId: string) => Promise<void>;
}

export function HuntCityCard({
  city,
  spots,
  cities,
  playerSessionId,
  characterName,
  myQueueSpotId,
  isAdmin,
  getSessionForSpot,
  getQueueForSpot,
  onStartHunt,
  onEndHunt,
  onAddToQueue,
  onRemoveFromQueue,
  onClaimSpot,
  onAddSpot,
  onDeleteSpot,
  onDeleteCity,
}: HuntCityCardProps) {
  const [addSpotOpen, setAddSpotOpen] = useState(false);
  const [deleteCityOpen, setDeleteCityOpen] = useState(false);

  const activeCount = spots.filter((s) => {
    const session = getSessionForSpot(s.id);
    return session && session.status !== "finished";
  }).length;

  return (
    <>
      <Card className="border-2 border-primary/20 bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-5 w-5 text-primary" />
              {city.name}
              <span className="text-xs font-normal text-muted-foreground">
                ({activeCount}/{spots.length} active)
              </span>
            </CardTitle>
            <div className="flex gap-1">
              {isAdmin && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAddSpotOpen(true)}
                    className="h-7 px-2 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" /> Spot
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteCityOpen(true)}
                    title="Delete city"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {spots.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <p>No spots registered.</p>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2"
                  onClick={() => setAddSpotOpen(true)}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add first spot
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {spots.map((spot) => (
                <HuntSpotCard
                  key={spot.id}
                  spotId={spot.id}
                  spotName={spot.name}
                  cityName={city.name}
                  session={getSessionForSpot(spot.id)}
                  queue={getQueueForSpot(spot.id)}
                  playerSessionId={playerSessionId}
                  characterName={characterName}
                  myQueueSpotId={myQueueSpotId}
                  isAdmin={isAdmin}
                  onStartHunt={onStartHunt}
                  onEndHunt={onEndHunt}
                  onAddToQueue={onAddToQueue}
                  onRemoveFromQueue={onRemoveFromQueue}
                  onClaimSpot={onClaimSpot}
                  onDeleteSpot={onDeleteSpot}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <>
          <AddSpotModal
            open={addSpotOpen}
            onClose={() => setAddSpotOpen(false)}
            onAdd={onAddSpot}
            cities={cities}
            preselectedCityId={city.id}
          />
          <DeleteConfirmModal
            open={deleteCityOpen}
            onClose={() => setDeleteCityOpen(false)}
            onConfirm={() => onDeleteCity(city.id)}
            description={`Are you sure you want to delete the city "${city.name}" and all its spots?`}
          />
        </>
      )}
    </>
  );
}
