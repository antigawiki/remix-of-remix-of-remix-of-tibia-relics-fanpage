import { useState } from 'react';
import { usePoll } from '@/hooks/usePoll';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { BarChart3 } from 'lucide-react';

const PollBox = () => {
  const { poll, results, totalVotes, loading, hasVoted, voting, castVote } = usePoll();
  const [selected, setSelected] = useState<string>('');

  if (loading || !poll) return null;

  const handleVote = () => {
    if (selected) castVote(selected);
  };

  return (
    <section>
      <div className="section-divider mb-4" />
      <h2 className="font-heading text-xl text-gold mb-4 flex items-center gap-2">
        <BarChart3 className="w-5 h-5" />
        Enquete
      </h2>
      <article className="news-box animate-fade-in">
        <header className="news-box-header">
          <h3 className="font-semibold">{poll.title}</h3>
        </header>
        <div className="news-box-content">
          {!hasVoted ? (
            <div className="space-y-3">
              <RadioGroup value={selected} onValueChange={setSelected}>
                {poll.options.map((opt) => (
                  <label
                    key={opt.key}
                    className="flex items-start gap-2 cursor-pointer text-sm leading-relaxed hover:text-gold transition-colors"
                  >
                    <RadioGroupItem value={opt.key} className="mt-0.5 shrink-0" />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </RadioGroup>
              <button
                onClick={handleVote}
                disabled={!selected || voting}
                className="retro-btn disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {voting ? 'Votando...' : 'Votar'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {poll.options.map((opt) => {
                const count = results[opt.key] || 0;
                const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                return (
                  <div key={opt.key} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="leading-relaxed">{opt.label}</span>
                      <span className="text-gold font-semibold shrink-0 ml-2">{pct}%</span>
                    </div>
                    <div className="w-full h-3 bg-secondary rounded-sm overflow-hidden">
                      <div
                        className="h-full bg-gold transition-all duration-500 rounded-sm"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">{count} voto{count !== 1 ? 's' : ''}</div>
                  </div>
                );
              })}
              <div className="text-xs text-muted-foreground pt-1">
                Total: {totalVotes} voto{totalVotes !== 1 ? 's' : ''}
              </div>
            </div>
          )}
        </div>
      </article>
    </section>
  );
};

export default PollBox;
