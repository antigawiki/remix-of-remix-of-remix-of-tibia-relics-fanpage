import { useParams, Link } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import SpellsTable from '@/components/SpellsTable';
import { 
  sorcererSpells, druidSpells, paladinSpells, knightSpells,
  spellVocations, Spell 
} from '@/data/spells';
import { Wand2, Sword, Crosshair, ChevronLeft } from 'lucide-react';

const vocationData: Record<string, Spell[]> = {
  sorcerer: sorcererSpells,
  druid: druidSpells,
  paladin: paladinSpells,
  knight: knightSpells,
};

const vocationIcons: Record<string, React.ReactNode> = {
  sorcerer: <Wand2 className="w-10 h-10 text-maroon" />,
  druid: <Wand2 className="w-10 h-10 text-maroon" />,
  paladin: <Crosshair className="w-10 h-10 text-maroon" />,
  knight: <Sword className="w-10 h-10 text-maroon" />,
};

const vocationDescriptions: Record<string, string> = {
  sorcerer: 'Magias ofensivas e de suporte',
  druid: 'Magias de cura e natureza',
  paladin: 'Magias de distância e suporte',
  knight: 'Magias de combate corpo-a-corpo',
};

const SpellsPage = () => {
  const { vocation } = useParams<{ vocation?: string }>();

  // Show vocation grid if no vocation selected
  if (!vocation) {
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
                {Object.entries(spellVocations).map(([key, voc]) => (
                  <Link 
                    key={key}
                    to={voc.path}
                    className="parchment p-4 rounded-sm flex items-center gap-3 hover:translate-y-[-2px] transition-transform"
                  >
                    {vocationIcons[key]}
                    <div>
                      <h3 className="font-heading font-semibold text-text-dark">{voc.name}</h3>
                      <p className="text-xs text-muted-foreground">{vocationDescriptions[key]}</p>
                      <p className="text-xs text-maroon mt-1">
                        {vocationData[key]?.length || 0} magias
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </div>
      </MainLayout>
    );
  }

  // Get spells for selected vocation
  const spells = vocationData[vocation] || [];
  const vocationInfo = spellVocations[vocation as keyof typeof spellVocations];

  if (!vocationInfo) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <section className="news-box">
            <header className="news-box-header">
              <h1 className="font-semibold">Vocação não encontrada</h1>
            </header>
            <div className="news-box-content">
              <p>A vocação "{vocation}" não existe.</p>
              <Link to="/spells" className="text-maroon hover:underline">
                Voltar para magias
              </Link>
            </div>
          </section>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <section className="news-box">
          <header className="news-box-header">
            <div className="flex items-center gap-2">
              <Link to="/spells" className="hover:text-gold transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <h1 className="font-semibold">Magias - {vocationInfo.name}</h1>
            </div>
          </header>
          <div className="news-box-content">
            <SpellsTable spells={spells} vocation={vocation} />
          </div>
        </section>
      </div>
    </MainLayout>
  );
};

export default SpellsPage;
