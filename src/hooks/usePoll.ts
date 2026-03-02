import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PollOption {
  key: string;
  label: string;
}

interface Poll {
  id: string;
  title: string;
  options: PollOption[];
  active: boolean;
}

interface PollResults {
  [key: string]: number;
}

export function usePoll() {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [results, setResults] = useState<PollResults>({});
  const [totalVotes, setTotalVotes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasVoted, setHasVoted] = useState(false);
  const [voting, setVoting] = useState(false);

  const fetchPoll = useCallback(async () => {
    const { data, error } = await supabase
      .from('polls')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      setLoading(false);
      return;
    }

    const pollData: Poll = {
      id: data.id,
      title: data.title,
      options: data.options as unknown as PollOption[],
      active: data.active,
    };
    setPoll(pollData);

    // Check localStorage for vote hint
    const voted = localStorage.getItem(`poll_voted_${data.id}`);
    if (voted) setHasVoted(true);

    await fetchResults(data.id);
    setLoading(false);
  }, []);

  const fetchResults = async (pollId: string) => {
    const { data, error } = await supabase
      .from('poll_votes')
      .select('option_key')
      .eq('poll_id', pollId);

    if (error || !data) return;

    const counts: PollResults = {};
    data.forEach((v) => {
      counts[v.option_key] = (counts[v.option_key] || 0) + 1;
    });
    setResults(counts);
    setTotalVotes(data.length);
  };

  const castVote = async (optionKey: string) => {
    if (!poll || voting) return;
    setVoting(true);

    try {
      const res = await supabase.functions.invoke('cast-vote', {
        body: { poll_id: poll.id, option_key: optionKey },
      });

      if (res.error) {
        // Try to parse the error body
        const body = res.data;
        if (body?.error === 'already_voted') {
          setHasVoted(true);
          localStorage.setItem(`poll_voted_${poll.id}`, 'true');
          await fetchResults(poll.id);
          return;
        }
        throw new Error(body?.message || 'Erro ao votar');
      }

      setHasVoted(true);
      localStorage.setItem(`poll_voted_${poll.id}`, 'true');
      await fetchResults(poll.id);
    } finally {
      setVoting(false);
    }
  };

  useEffect(() => {
    fetchPoll();
  }, [fetchPoll]);

  return { poll, results, totalVotes, loading, hasVoted, voting, castVote };
}
