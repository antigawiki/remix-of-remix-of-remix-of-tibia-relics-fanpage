import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePoll } from '@/hooks/usePoll';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { BarChart3 } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { formatDistanceToNow } from 'date-fns';
import { ptBR, enUS, es, pl } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

const localeMap = { pt: ptBR, en: enUS, es, pl };

const PollBox = () => {
  const { t, language } = useTranslation();
  const { poll, results, totalVotes, loading, hasVoted, voting, castVote, isExpired, showResults } = usePoll();
  const [selected, setSelected] = useState<string>('');

  if (loading || !poll) return null;

  const handleVote = () => {
    if (selected) castVote(selected);
  };

  const canVote = poll.active && !isExpired && !hasVoted;

  return (
    <section>
      <div className="section-divider mb-4" />
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-xl text-gold flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          {t('poll.sectionTitle')}
        </h2>
        <Link to="/polls" className="text-xs gold-link">
          {t('poll.viewAll')} →
        </Link>
      </div>
      <article className="news-box animate-fade-in">
        <header className="news-box-header flex items-center justify-between">
          <h3 className="font-semibold">{poll.title}</h3>
          {isExpired || !poll.active ? (
            <Badge variant="destructive" className="text-xs">{t('poll.ended')}</Badge>
          ) : poll.ends_at ? (
            <span className="text-xs text-muted-foreground">
              {t('poll.endsAt')} {formatDistanceToNow(new Date(poll.ends_at), { locale: localeMap[language] })}
            </span>
          ) : null}
        </header>
        <div className="news-box-content">
          {canVote ? (
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
                {voting ? t('poll.voting') : t('poll.vote')}
              </button>
            </div>
          ) : (
            <PollResults poll={poll} results={results} totalVotes={totalVotes} />
          )}
        </div>
      </article>
    </section>
  );
};

interface PollResultsProps {
  poll: { options: { key: string; label: string }[] };
  results: Record<string, number>;
  totalVotes: number;
}

export const PollResults = ({ poll, results, totalVotes }: PollResultsProps) => {
  const { t } = useTranslation();

  return (
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
            <div className="text-xs text-muted-foreground">
              {count} {count !== 1 ? t('poll.votes') : t('poll.vote_singular')}
            </div>
          </div>
        );
      })}
      <div className="text-xs text-muted-foreground pt-1">
        {t('poll.total')}: {totalVotes} {totalVotes !== 1 ? t('poll.votes') : t('poll.vote_singular')}
      </div>
    </div>
  );
};

export default PollBox;
