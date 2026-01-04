import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface NewsItem {
  id: string;
  title: string;
  date: string;
  author: string;
  content: string;
  created_at?: string;
}

export function useNews() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = async () => {
    setLoading(true);
    setError(null);
    
    const { data, error } = await supabase
      .from('news')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching news:', error);
      setError(error.message);
      setNews([]);
    } else {
      setNews(data || []);
    }
    setLoading(false);
  };

  const addNews = async (item: Omit<NewsItem, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
      .from('news')
      .insert([item])
      .select()
      .single();

    if (error) {
      console.error('Error adding news:', error);
      throw error;
    }

    setNews(prev => [data, ...prev]);
    return data;
  };

  const updateNews = async (id: string, updates: Partial<NewsItem>) => {
    const { data, error } = await supabase
      .from('news')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating news:', error);
      throw error;
    }

    setNews(prev => prev.map(item => item.id === id ? data : item));
    return data;
  };

  const deleteNews = async (id: string) => {
    const { error } = await supabase
      .from('news')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting news:', error);
      throw error;
    }

    setNews(prev => prev.filter(item => item.id !== id));
  };

  useEffect(() => {
    fetchNews();
  }, []);

  return {
    news,
    loading,
    error,
    fetchNews,
    addNews,
    updateNews,
    deleteNews,
  };
}
