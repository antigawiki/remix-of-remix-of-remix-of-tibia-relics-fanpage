import { useState } from "react";
import { useHuntAdmin } from "@/hooks/useHuntAdmin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { HuntCityCard } from "@/components/hunt/HuntCityCard";
import { AddCityModal } from "@/components/hunt/AddCityModal";
import { AddSpotModal } from "@/components/hunt/AddSpotModal";
import { Shield, Building2, Sword, Users, MapPin, Plus, LogOut, RefreshCw, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PASSWORD = "ondethweed";
const SESSION_KEY = "hunt_admin_auth";

export default function HuntAdminPage() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(SESSION_KEY) === "1");
  const [password, setPassword] = useState("");
  const [pwError, setPwError] = useState(false);
  const [addCityOpen, setAddCityOpen] = useState(false);
  const [addSpotOpen, setAddSpotOpen] = useState(false);
  const { toast } = useToast();

  const hunt = useHuntAdmin();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setAuthed(true);
      setPwError(false);
    } else {
      setPwError(true);
      setPassword("");
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setAuthed(false);
  };

  const requestNotification = async () => {
    if ("Notification" in window) {
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        toast({ title: "✅ Notifications enabled!", description: "You will be notified about hunts." });
      } else {
        toast({ title: "Notifications blocked", description: "Enable them in your browser settings.", variant: "destructive" });
      }
    }
  };

  // === LOGIN SCREEN ===
  if (!authed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm border-2 border-primary/30">
          <CardHeader className="text-center space-y-2">
            <div className="flex justify-center">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-7 w-7 text-primary" />
              </div>
            </div>
            <CardTitle className="text-xl">Hunt Admin</CardTitle>
            <CardDescription>Restricted area — enter the password to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pw">Password</Label>
                <Input
                  id="pw"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  autoFocus
                  className={pwError ? "border-destructive" : ""}
                />
                {pwError && (
                  <p className="text-xs text-destructive">Wrong password. Try again.</p>
                )}
              </div>
              <Button type="submit" className="w-full">
                Login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // === DASHBOARD ===
  const { cities, spots, loading, totalActive, totalInQueue, totalFreeSpots } = hunt;

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <div className="border-b border-border/60 bg-card/50 sticky top-0 z-40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sword className="h-5 w-5 text-primary" />
            <span className="font-bold text-base">Hunt Admin</span>
            <Badge variant="outline" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              Queue: {totalInQueue}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={requestNotification} title="Enable notifications">
              <Bell className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={hunt.fetchAll} title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleLogout} className="text-muted-foreground">
              <LogOut className="h-4 w-4 mr-1" /> Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
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

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setAddCityOpen(true)}>
            <Building2 className="h-4 w-4 mr-2" /> Add City
          </Button>
          <Button variant="outline" onClick={() => setAddSpotOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add Spot
          </Button>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : cities.length === 0 ? (
          <Card className="border-dashed border-2 border-border/40">
            <CardContent className="flex flex-col items-center justify-center py-16 space-y-3">
              <Building2 className="h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground text-sm text-center">
                No cities registered yet.<br />
                Click "Add City" to get started.
              </p>
              <Button onClick={() => setAddCityOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Add City
              </Button>
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

      {/* Modals */}
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
    </div>
  );
}
