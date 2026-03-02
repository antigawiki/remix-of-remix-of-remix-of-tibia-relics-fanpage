import { useState } from 'react';
import MainLayout from '@/layouts/MainLayout';
import Breadcrumb from '@/components/Breadcrumb';
import { usePolls } from '@/hooks/usePoll';
import { PollResults } from '@/components/PollBox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { BarChart3 } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR, enUS, es, pl } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

const localeMap = { pt: ptBR, en: enUS, es, pl };

const PollsPage = () => {
  const { t, language } = useTranslation();
  const { polls, allResults, loading } = usePolls();

  return (
    <MainLayout>
      <Breadcrumb />
      <div className="space-y-6">
        <div className="news-box">
          <header className="news-box-header">
            <h1 className="font-heading text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              {t('poll.pageTitle')}
            </h1>
          </header>
          <div className="news-box-content">
            <p className="text-sm text-muted-foreground">{t('poll.pageDescription')}</p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : polls.length === 0 ? (
          <div className="news-box">
            <div className="news-box-content text-center text-muted-foreground py-8">
              {t('poll.noPolls')}
            </div>
          </div>
        ) : (
          polls.map((poll) => (
            <PollCard
              key={poll.id}
              poll={poll}
              results={allResults[poll.id]?.results || {}}
              totalVotes={allResults[poll.id]?.total || 0}
              language={language}
            />
          ))
        )}
      </div>
    </MainLayout>
  );
};

interface PollCardProps {
  poll: {
    id: string;
    title: string;
    options: { key: string; label: string }[];
    active: boolean;
    ends_at: string | null;
    created_at: string;
  };
  results: Record<string, number>;
  totalVotes: number;
  language: string;
}

const PollCard = ({ poll, results, totalVotes, language }: PollCardProps) => {
  const { t } = useTranslation();
  const isExpired = poll.ends_at ? new Date(poll.ends_at) < new Date() : false;
  const hasVoted = !!localStorage.getItem(`poll_voted_${poll.id}`);
  const canVote = poll.active && !isExpired && !hasVoted;
  const [selected, setSelected] = useState('');
  const [voting, setVoting] = useState(false);
  const [localHasVoted, setLocalHasVoted] = useState(hasVoted);
  const [localResults, setLocalResults] = useState(results);
  const [localTotal, setLocalTotal] = useState(totalVotes);

  const handleVote = async () => {
    if (!selected || voting) return;
    setVoting(true);
    try {
      const res = await supabase.functions.invoke('cast-vote', {
        body: { poll_id: poll.id, option_key: selected },
      });
      if (res.error) {
        const body = res.data;
        if (body?.error === 'already_voted') {
          setLocalHasVoted(true);
          localStorage.setItem(`poll_voted_${poll.id}`, 'true');
          return;
        }
      }
      setLocalHasVoted(true);
      localStorage.setItem(`poll_voted_${poll.id}`, 'true');
      setLocalResults((prev) => ({
        ...prev,
        [selected]: (prev[selected] || 0) + 1,
      }));
      setLocalTotal((prev) => prev + 1);
    } finally {
      setVoting(false);
    }
  };

  const showResults = localHasVoted || isExpired || !poll.active;
  const locale = localeMap[language as keyof typeof localeMap] || enUS;

  return (
    <article className="news-box animate-fade-in">
      <header className="news-box-header flex items-center justify-between">
        <h3 className="font-semibold">{poll.title}</h3>
        <div className="flex items-center gap-2">
          {isExpired || !poll.active ? (
            <Badge variant="destructive" className="text-xs">{t('poll.closed')}</Badge>
          ) : (
            <Badge className="text-xs bg-green-600 text-primary-foreground">{t('poll.active')}</Badge>
          )}
        </div>
      </header>
      <div className="news-box-content">
        <div className="text-xs text-muted-foreground mb-3 flex gap-3">
          <span>{format(new Date(poll.created_at), 'dd/MM/yyyy', { locale })}</span>
          {poll.ends_at && !isExpired && (
            <span>
              {t('poll.endsAt')} {formatDistanceToNow(new Date(poll.ends_at), { locale })}
            </span>
          )}
          {poll.ends_at && isExpired && (
            <span>{t('poll.ended')}</span>
          )}
        </div>

        {showResults ? (
          <PollResults poll={poll} results={localResults} totalVotes={localTotal} />
        ) : (
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
        )}
      </div>
    </article>
  );
};

export default PollsPage;
