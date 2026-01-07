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
          <div className="space-y-3 text-sm">
            {/* Tempo PZ */}
            <div className="bg-muted/30 rounded p-2">
              <span className="text-destructive font-medium block mb-1">⏱️ Tempo PZ</span>
              <span className="text-text-dark">1 min sem Kill / 15 min com Kill</span>
            </div>

            {/* White Skull */}
            <div className="bg-muted/30 rounded p-2">
              <span className="text-destructive font-medium block mb-1">💀 White Skull</span>
              <div className="text-text-dark space-y-0.5">
                <div>
                  • Até <span className="font-semibold">2 Kills</span> em 24 horas
                </div>
                <div>
                  • Até <span className="font-semibold">4 Kills</span> em 7 dias
                </div>
                <div>
                  • Até <span className="font-semibold">9 Kills</span> em 30 dias
                </div>
              </div>
            </div>

            {/* Red Skull */}
            <div className="bg-destructive/10 rounded p-2 border border-destructive/20">
              <span className="text-destructive font-medium block mb-1">☠️ Red Skull</span>
              <div className="text-text-dark space-y-0.5">
                <div>
                  • A partir de <span className="font-semibold">3 Kills</span> em 24 horas
                </div>
                <div>
                  • A partir de <span className="font-semibold">5 Kills</span> em 7 dias
                </div>
                <div>
                  • A partir de <span className="font-semibold">10 Kills</span> em 30 dias
                </div>
              </div>
            </div>

            {/* Ban */}
            <div className="bg-destructive/20 rounded p-2 border border-destructive/30">
              <span className="text-destructive font-medium block mb-1">🚫 Frags/Ban</span>
              <span className="text-text-dark">Quando exceder 2x o necessário para Red Skull</span>
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
