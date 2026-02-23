// App root component
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/i18n";
import Index from "./pages/Index";
import AdminPage from "./pages/AdminPage";
import EquipmentPage from "./pages/EquipmentPage";
import ItemsPage from "./pages/ItemsPage";
import SpellsPage from "./pages/SpellsPage";
import CreaturesPage from "./pages/CreaturesPage";
import InfoPage from "./pages/InfoPage";
import CalculatorsPage from "./pages/CalculatorsPage";
import LootCalculator from "./pages/calculators/LootCalculator";
import HealDamageCalculator from "./pages/calculators/HealDamageCalculator";
import PhysicalDamageCalculator from "./pages/calculators/PhysicalDamageCalculator";
import DeathExperienceCalculator from "./pages/calculators/DeathExperienceCalculator";
import ExperienceLevelCalculator from "./pages/calculators/ExperienceLevelCalculator";
import MagicLevelCalculator from "./pages/calculators/MagicLevelCalculator";
import SkillsCalculator from "./pages/calculators/SkillsCalculator";
import StatsCalculator from "./pages/calculators/StatsCalculator";
import QuestsPage from "./pages/QuestsPage";
import QuestDetailPage from "./pages/QuestDetailPage";
import HighscoresPage from "./pages/HighscoresPage";
import OnlinePlayersPage from "./pages/OnlinePlayersPage";
import DeathRowPage from "./pages/DeathRowPage";
import LatestDeathsPage from "./pages/LatestDeathsPage";
import TopGainersPage from "./pages/TopGainersPage";
import RunesPage from "./pages/RunesPage";
import XpTrackerPage from "./pages/XpTrackerPage";
import AltDetectorPage from "./pages/AltDetectorPage";
import AltPlayerSessionsPage from "./pages/AltPlayerSessionsPage";
import ImportPage from "./pages/ImportPage";
import HuntAdminPage from "./pages/HuntAdminPage";
import XpActivityPage from "./pages/XpActivityPage";
import KillStatisticsPage from "./pages/KillStatisticsPage";
import HousesPage from "./pages/HousesPage";
import CamPlayerPage from "./pages/CamPlayerPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/equipment" element={<EquipmentPage />} />
              <Route path="/equipment/:category" element={<EquipmentPage />} />
              <Route path="/items" element={<ItemsPage />} />
              <Route path="/items/:category" element={<ItemsPage />} />
              <Route path="/spells" element={<SpellsPage />} />
              <Route path="/spells/:vocation" element={<SpellsPage />} />
              <Route path="/creatures" element={<CreaturesPage />} />
              <Route path="/info" element={<InfoPage />} />
              <Route path="/calculators" element={<CalculatorsPage />} />
              <Route path="/calculators/heal-damage" element={<HealDamageCalculator />} />
              <Route path="/calculators/physical-damage" element={<PhysicalDamageCalculator />} />
              <Route path="/calculators/death-experience" element={<DeathExperienceCalculator />} />
              <Route path="/calculators/experience-level" element={<ExperienceLevelCalculator />} />
              <Route path="/calculators/magic-level" element={<MagicLevelCalculator />} />
              <Route path="/calculators/skills" element={<SkillsCalculator />} />
              <Route path="/calculators/stats" element={<StatsCalculator />} />
              <Route path="/calculators/loot" element={<LootCalculator />} />
              <Route path="/quests" element={<QuestsPage />} />
              <Route path="/quests/:slug" element={<QuestDetailPage />} />
              <Route path="/highscores" element={<HighscoresPage />} />
              <Route path="/online" element={<OnlinePlayersPage />} />
              <Route path="/death-row" element={<DeathRowPage />} />
              <Route path="/latest-deaths" element={<LatestDeathsPage />} />
              <Route path="/top-gainers" element={<TopGainersPage />} />
              <Route path="/runes" element={<RunesPage />} />
              <Route path="/xp-tracker" element={<XpTrackerPage />} />
              <Route path="/d4f8a2c91b3e7f05a6d2e8b4c7f1a9e3" element={<AltDetectorPage />} />
              <Route path="/d4f8a2c91b3e7f05a6d2e8b4c7f1a9e3/:playerName" element={<AltPlayerSessionsPage />} />
              <Route path="/import-data-temp" element={<ImportPage />} />
              <Route path="/hunt-admin" element={<HuntAdminPage />} />
              <Route path="/xp-activity" element={<XpActivityPage />} />
              <Route path="/kill-statistics" element={<KillStatisticsPage />} />
              <Route path="/houses" element={<HousesPage />} />
              <Route path="/cam-player" element={<CamPlayerPage />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
