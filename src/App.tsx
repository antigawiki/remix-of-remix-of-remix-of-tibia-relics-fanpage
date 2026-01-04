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
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
