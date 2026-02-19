import { useState } from "react";
import { useHuntAdmin } from "@/hooks/useHuntAdmin";
import { usePlayerSession } from "@/hooks/usePlayerSession";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { HuntCityCard } from "@/components/hunt/HuntCityCard";
import { AddCityModal } from "@/components/hunt/AddCityModal";
import { AddSpotModal } from "@/components/hunt/AddSpotModal";
import { MyQueueStatus } from "@/components/hunt/MyQueueStatus";
import { Shield, Building2, Sword, Users, MapPin, Plus, LogOut, RefreshCw } from "lucide-react";

const ADMIN_PASSWORD = "relic7.4";
const USER_PASSWORD = "ondethweed";
const SESSION_KEY = "hunt_admin_auth";

export default function HuntAdminPage() {
  const { sessionId, characterName, saveCharacterName, myQueueItem, leaveQueue, claimMySpot, refetch } = usePlayerSession();

  // Has the user set their character name?
  const [entered, setEntered] = useState(() => !!characterName && !!sessionStorage.getItem(SESSION_KEY));
  const [charInput, setCharInput] = useState(characterName);
  const [passwordInput, setPasswordInput] = useState("");
  const [pwError, setPwError] = useState(false);
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(SESSION_KEY) === "admin");

  const [addCityOpen, setAddCityOpen] = useState(false);
  const [addSpotOpen, setAddSpotOpen] = useState(false);

  const hunt = useHuntAdmin();

  const myQueueSpotId = myQueueItem?.spot_id ?? null;

  const handleEnter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!charInput.trim() || !passwordInput.trim()) return;

    if (passwordInput === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "admin");
      setAuthed(true);
      setPwError(false);
    } else if (passwordInput === USER_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "user");
      setAuthed(false);
      setPwError(false);
    } else {
      setPwError(true);
      return;
    }

    saveCharacterName(charInput.trim());
    setEntered(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setAuthed(false);
    setEntered(false);
    setCharInput("");
    setPasswordInput("");
    setPwError(false);
  };

  const handleLeaveQueue = async () => {
    await leaveQueue();
    await hunt.fetchAll();
    refetch();
  };

  const handleClaimMySpot = async () => {
    await claimMySpot();
    await hunt.fetchAll();
    refetch();
  };

  // === ENTRY SCREEN ===
  if (!entered) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm border-2 border-primary/30">
          <CardHeader className="text-center space-y-2">
            <div className="flex justify-center">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Sword className="h-7 w-7 text-primary" />
              </div>
            </div>
            <CardTitle className="text-xl">Hunt Manager</CardTitle>
            <CardDescription>
              Enter your character name and access password to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEnter} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="char-name">Character Name</Label>
                <Input
                  id="char-name"
                  value={charInput}
                  onChange={(e) => setCharInput(e.target.value)}
                  placeholder="Your in-game nick..."
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pw" className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                  Password
                </Label>
                <Input
                  id="pw"
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••••"
                  className={pwError ? "border-destructive" : ""}
                />
                {pwError && (
                  <p className="text-xs text-destructive">Wrong password. Try again.</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={!charInput.trim() || !passwordInput.trim()}>
                Enter
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // === MAIN PAGE ===
  const { cities, spots, loading, totalActive, totalInQueue, totalFreeSpots } = hunt;

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <div className="border-b border-border/60 bg-card/50 sticky top-0 z-40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sword className="h-5 w-5 text-primary" />
            <span className="font-bold text-base">Hunt Manager</span>
            <Badge variant="outline" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              Queue: {totalInQueue}
            </Badge>
            {authed && (
              <Badge variant="secondary" className="text-xs">
                <Shield className="h-3 w-3 mr-1" /> Admin
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:block">
              Playing as: <span className="font-semibold text-foreground">{characterName}</span>
            </span>
            <Button size="sm" variant="outline" onClick={hunt.fetchAll} title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleLogout} className="text-muted-foreground">
              <LogOut className="h-4 w-4 mr-1" /> Exit
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* My Queue Status */}
        {myQueueItem && (
          <MyQueueStatus
            myQueueItem={myQueueItem}
            onLeave={handleLeaveQueue}
            onClaim={handleClaimMySpot}
          />
        )}

        {/* Admin stats */}
        {authed && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Cities", value: cities.length, icon: Building2, color: "text-blue-400" },
                { label: "Active Hunts", value: totalActive, icon: Sword, color: "text-green-400" },
                { label: "Free Spots", value: totalFreeSpots, icon: MapPin, color: "text-primary" },
                { label: "In Queue", value: totalInQueue, icon: Users, color: "text-yellow-400" },
              ].map(({ label, value, icon: Icon, color }) => (
                <Card key={label} className="border border-border/60">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Icon className={`h-8 w-8 ${color} shrink-0`} />
                    <div>
                      <p className="text-2xl font-bold">{value}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setAddCityOpen(true)}>
                <Building2 className="h-4 w-4 mr-2" /> Add City
              </Button>
              <Button variant="outline" onClick={() => setAddSpotOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Add Spot
              </Button>
            </div>
          </>
        )}

        {/* Spots list */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : cities.length === 0 ? (
          <Card className="border-dashed border-2 border-border/40">
            <CardContent className="flex flex-col items-center justify-center py-16 space-y-3">
              <Building2 className="h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground text-sm text-center">
                No cities registered yet.
                {authed && <><br />Click "Add City" to get started.</>}
              </p>
              {authed && (
                <Button onClick={() => setAddCityOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Add City
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {cities.map((city) => (
              <HuntCityCard
                key={city.id}
                city={city}
                cities={cities}
                spots={hunt.getSpotsForCity(city.id)}
                playerSessionId={sessionId}
                characterName={characterName}
                myQueueSpotId={myQueueSpotId}
                isAdmin={authed}
                getSessionForSpot={hunt.getSessionForSpot}
                getQueueForSpot={hunt.getQueueForSpot}
                onStartHunt={hunt.startHunt}
                onEndHunt={hunt.endHuntEarly}
                onAddToQueue={hunt.addToQueue}
                onRemoveFromQueue={hunt.removeFromQueue}
                onClaimSpot={hunt.claimSpot}
                onAddSpot={hunt.addSpot}
                onDeleteSpot={hunt.deleteSpot}
                onDeleteCity={hunt.deleteCity}
              />
            ))}
          </div>
        )}
      </div>

      {authed && (
        <>
          <AddCityModal
            open={addCityOpen}
            onClose={() => setAddCityOpen(false)}
            onAdd={hunt.addCity}
          />
          <AddSpotModal
            open={addSpotOpen}
            onClose={() => setAddSpotOpen(false)}
            onAdd={hunt.addSpot}
            cities={cities}
          />
        </>
      )}
    </div>
  );
}
