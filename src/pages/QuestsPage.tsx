import MainLayout from "@/layouts/MainLayout";
import { Construction, Scroll } from "lucide-react";

const QuestsPage = () => {
  return (
    <MainLayout>
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <div className="bg-card/80 backdrop-blur-sm border-2 border-border rounded-lg p-8 md:p-12 max-w-lg">
          <div className="flex justify-center gap-4 mb-6">
            <Scroll className="w-12 h-12 text-gold" />
            <Construction className="w-12 h-12 text-maroon" />
          </div>
          
          <h1 className="text-2xl md:text-3xl font-bold text-maroon mb-4">
            Quests
          </h1>
          
          <div className="space-y-4 text-muted-foreground">
            <p className="text-lg">
              🚧 <span className="text-gold font-semibold">Em Construção</span> 🚧
            </p>
            
            <p>
              Esta seção está sendo desenvolvida com a ajuda da comunidade.
            </p>
            
            <p>
              Conforme as quests forem sendo descobertas pelos jogadores, 
              elas serão documentadas e divulgadas aqui.
            </p>
            
            <p className="text-sm italic mt-6">
              Descobriu uma quest? Entre em contato e ajude a comunidade!
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default QuestsPage;
