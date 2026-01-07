const ServerInfo = () => {
  return (
    <div className="news-box">
      <header className="news-box-header">
        <h3 className="font-semibold">Informações do Servidor</h3>
      </header>
      <div className="news-box-content space-y-4">
        {/* Rates */}
        <div>
          <h4 className="font-heading text-sm font-semibold text-maroon mb-2 border-b border-border pb-1">Rates</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Experiência:</span>
              <span className="font-semibold">1x</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Magic:</span>
              <span className="font-semibold">1x</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Skills:</span>
              <span className="font-semibold">1x</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Loot:</span>
              <span className="font-semibold">1x</span>
            </div>
          </div>
        </div>

        {/* Skull System */}
        <div>
          <h4 className="font-heading text-sm font-semibold text-maroon mb-2 border-b border-border pb-1">
            Sistema de Skull
          </h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tempo PZ:</span>
              <span className="font-semibold">1 min sem Kill</span>
              <p>
              <span className="font-semibold">15 min com Kill.</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">White Skull:</span>
              <span className="font-semibold">Até 2 Kills em 24 hrs, até 4 em 7 dias e até 9 em 30 dias.</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Red Skull:</span>
              <span className="font-semibold">A partir de 3 Kills em 24 horas, 5 em 7 dias e 10 em 30 dias. Dias</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Frags/Ban:</span>
              <span className="font-semibold">Quando Exceder 2x o Necessário para Red Skull</span>
            </div>
          </div>
        </div>

        {/* General */}
        <div>
          <h4 className="font-heading text-sm font-semibold text-maroon mb-2 border-b border-border pb-1">Geral</h4>
          <ul className="text-sm space-y-1 text-text-dark">
            <li>• Informações serão atualizadas em breve</li>
            <li>• Visite o site oficial para mais detalhes</li>
          </ul>
        </div>

        <a
          href="https://tibiarelic.com"
          target="_blank"
          rel="noopener noreferrer"
          className="retro-btn block text-center w-full mt-4"
        >
          Acessar Site Oficial
        </a>
      </div>
    </div>
  );
};

export default ServerInfo;
