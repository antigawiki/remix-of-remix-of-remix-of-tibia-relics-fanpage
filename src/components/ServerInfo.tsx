const ServerInfo = () => {
  return (
    <div className="news-box">
      <header className="news-box-header">
        <h3 className="font-semibold">Informações do Servidor</h3>
      </header>
      <div className="news-box-content space-y-4">
        {/* Rates */}
        <div>
          <h4 className="font-heading text-sm font-semibold text-maroon mb-2 border-b border-border pb-1">
            Rates
          </h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Experiência:</span>
              <span className="font-semibold">Custom</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Magic:</span>
              <span className="font-semibold">Custom</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Skills:</span>
              <span className="font-semibold">Custom</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Loot:</span>
              <span className="font-semibold">Custom</span>
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
              <span className="font-semibold">--</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">White Skull:</span>
              <span className="font-semibold">--</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Red Skull:</span>
              <span className="font-semibold">--</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Frags/Ban:</span>
              <span className="font-semibold">--</span>
            </div>
          </div>
        </div>

        {/* General */}
        <div>
          <h4 className="font-heading text-sm font-semibold text-maroon mb-2 border-b border-border pb-1">
            Geral
          </h4>
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
