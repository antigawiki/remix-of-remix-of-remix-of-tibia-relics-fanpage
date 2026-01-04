import MainLayout from '@/layouts/MainLayout';
import { Link } from 'react-router-dom';
import { Wand2, Sword, Crosshair } from 'lucide-react';

const SpellsPage = () => {
  const vocations = [
    { name: 'Sorcerer', icon: Wand2, path: '/spells/sorcerer', desc: 'Magias ofensivas e de suporte' },
    { name: 'Druid', icon: Wand2, path: '/spells/druid', desc: 'Magias de cura e natureza' },
    { name: 'Paladin', icon: Crosshair, path: '/spells/paladin', desc: 'Magias de distância e suporte' },
    { name: 'Knight', icon: Sword, path: '/spells/knight', desc: 'Magias de combate corpo-a-corpo' },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <section className="news-box">
          <header className="news-box-header">
            <h1 className="font-semibold">Magias</h1>
          </header>
          <div className="news-box-content">
            <p className="text-sm leading-relaxed mb-4">
              Consulte as magias disponíveis para cada vocação no Tibia Relic.
            </p>

            <div className="grid grid-cols-2 gap-4">
              {vocations.map((voc) => (
                <Link 
                  key={voc.name}
                  to={voc.path}
                  className="parchment p-4 rounded-sm flex items-center gap-3 hover:translate-y-[-2px] transition-transform"
                >
                  <voc.icon className="w-10 h-10 text-maroon" />
                  <div>
                    <h3 className="font-heading font-semibold text-text-dark">{voc.name}</h3>
                    <p className="text-xs text-muted-foreground">{voc.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </MainLayout>
  );
};

export default SpellsPage;
