import { Heart } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="wood-panel mt-8 py-6">
      <div className="container">
        <div className="section-divider mb-4" />
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <span>Feito com</span>
            <Heart className="w-4 h-4 text-destructive fill-destructive" />
            <span>para a comunidade</span>
          </div>
          
          <div className="text-center">
            <p>Tibia Relic Fan Page © 2024</p>
            <p className="text-xs mt-1">
              Tibia® é uma marca registrada da CipSoft GmbH.
            </p>
          </div>
          
          <div>
            <a 
              href="https://tibiarelic.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="gold-link hover:underline"
            >
              tibiarelic.com
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
