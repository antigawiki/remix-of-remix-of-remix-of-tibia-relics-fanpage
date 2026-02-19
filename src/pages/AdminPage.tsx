import { useState } from 'react';
import { Plus, Edit, Trash2, Save, X, RefreshCw, Loader2 } from 'lucide-react';
import MainLayout from '@/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useNews, NewsItem } from '@/hooks/useNews';
import { SystemStatus } from '@/components/admin/SystemStatus';

const AdminPage = () => {
  const { toast } = useToast();
  const { news, loading, error, fetchNews, addNews, updateNews, deleteNews } = useNews();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<NewsItem>>({});

  const handleEdit = (item: NewsItem) => {
    setEditingId(item.id);
    setFormData(item);
    setIsAdding(false);
  };

  const handleAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setFormData({
      title: '',
      date: new Date().toLocaleDateString('pt-BR'),
      author: 'Admin',
      content: '',
    });
  };

  const handleSave = async () => {
    if (!formData.title || !formData.content) {
      toast({
        title: 'Erro',
        description: 'Título e conteúdo são obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    
    try {
      if (isAdding) {
        await addNews({
          title: formData.title!,
          date: formData.date!,
          author: formData.author!,
          content: formData.content!,
        });
        toast({
          title: 'Sucesso',
          description: 'Notícia adicionada com sucesso!',
        });
      } else if (editingId) {
        await updateNews(editingId, {
          title: formData.title,
          date: formData.date,
          author: formData.author,
          content: formData.content,
        });
        toast({
          title: 'Sucesso',
          description: 'Notícia atualizada com sucesso!',
        });
      }

      setIsAdding(false);
      setEditingId(null);
      setFormData({});
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Erro ao salvar notícia.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({});
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNews(id);
      toast({
        title: 'Sucesso',
        description: 'Notícia removida com sucesso!',
      });
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Erro ao remover notícia.',
        variant: 'destructive',
      });
    }
  };

  return (
    <MainLayout showSidebars={false}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* System Status */}
        <div className="news-box">
          <header className="news-box-header">
            <h2 className="font-semibold">Status do Sistema 24/7</h2>
          </header>
          <div className="news-box-content">
            <SystemStatus />
          </div>
        </div>

        {/* Header */}
        <div className="news-box">
          <header className="news-box-header">
            <h1 className="font-semibold">Painel Administrativo</h1>
            <Button 
              onClick={fetchNews} 
              variant="ghost" 
              size="sm"
              disabled={loading}
              className="text-white hover:bg-primary/20"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </header>
          <div className="news-box-content">
            <p className="text-sm text-muted-foreground">
              Gerencie as notícias do site
            </p>
            {error && (
              <p className="text-xs text-destructive bg-destructive/10 p-2 rounded mt-2">
                <strong>Erro:</strong> {error}
              </p>
            )}
          </div>
        </div>


        {/* Add Button */}
        {!isAdding && !editingId && (
          <Button onClick={handleAdd} className="retro-btn w-full flex items-center gap-2 justify-center">
            <Plus className="w-4 h-4" />
            Adicionar Notícia
          </Button>
        )}

        {/* Add/Edit Form */}
        {(isAdding || editingId) && (
          <div className="news-box animate-fade-in">
            <header className="news-box-header">
              <h3 className="font-semibold">
                {isAdding ? 'Nova Notícia' : 'Editar Notícia'}
              </h3>
            </header>
            <div className="news-box-content space-y-4">
              <div>
                <label className="text-sm font-semibold text-text-dark block mb-1">
                  Título
                </label>
                <Input
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Título da notícia"
                  className="bg-background/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-text-dark block mb-1">
                    Data
                  </label>
                  <Input
                    value={formData.date || ''}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    placeholder="DD/MM/AAAA"
                    className="bg-background/50"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-text-dark block mb-1">
                    Autor
                  </label>
                  <Input
                    value={formData.author || ''}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                    placeholder="Nome do autor"
                    className="bg-background/50"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-text-dark block mb-1">
                  Conteúdo (HTML permitido)
                </label>
                <Textarea
                  value={formData.content || ''}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="<p>Conteúdo da notícia...</p>"
                  rows={5}
                  className="bg-background/50"
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handleSave} 
                  className="retro-btn flex items-center gap-2"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isSaving ? 'Salvando...' : 'Salvar'}
                </Button>
                <Button onClick={handleCancel} variant="outline" className="flex items-center gap-2">
                  <X className="w-4 h-4" />
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gold" />
            <span className="ml-2 text-sm text-muted-foreground">Carregando notícias...</span>
          </div>
        )}

        {/* News List */}
        {!loading && (
          <div className="space-y-4">
            <h2 className="font-heading text-lg text-gold">
              Notícias Cadastradas ({news.length})
            </h2>
            
            {news.length === 0 && !error && (
              <div className="news-box">
                <div className="news-box-content text-center py-6">
                  <p className="text-muted-foreground">Nenhuma notícia cadastrada.</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Clique em "Adicionar Notícia" para criar a primeira.
                  </p>
                </div>
              </div>
            )}
            
            {news.map((item) => (
              <div key={item.id} className="news-box animate-fade-in">
                <header className="news-box-header">
                  <h3 className="font-semibold">{item.title}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs opacity-80">{item.date}</span>
                    <button
                      onClick={() => handleEdit(item)}
                      className="p-1 hover:bg-primary/20 rounded transition-colors"
                      title="Editar"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1 hover:bg-destructive/20 rounded transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </header>
                <div className="news-box-content">
                  <div 
                    className="text-sm"
                    dangerouslySetInnerHTML={{ __html: item.content }}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Por: {item.author}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default AdminPage;
