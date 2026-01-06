import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import AdminPage from "./pages/AdminPage";
import EquipmentPage from "./pages/EquipmentPage";
import ItemsPage from "./pages/ItemsPage";
import SpellsPage from "./pages/SpellsPage";
import CreaturesPage from "./pages/CreaturesPage";
import InfoPage from "./pages/InfoPage";
import CalculatorsPage from "./pages/CalculatorsPage";
import HealDamageCalculator from "./pages/calculators/HealDamageCalculator";
import PhysicalDamageCalculator from "./pages/calculators/PhysicalDamageCalculator";
import DeathExperienceCalculator from "./pages/calculators/DeathExperienceCalculator";
import QuestsPage from "./pages/QuestsPage";
import NotFound from "./pages/NotFound";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
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
          <Route path="/quests" element={<QuestsPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
