import { useState } from 'react';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';
import MainLayout from '@/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface NewsItem {
  id: string;
  title: string;
  date: string;
  author: string;
  content: string;
}

// Mock data - in production this would come from a database
const initialNews: NewsItem[] = [
  {
    id: '1',
    title: 'Wiki em Construção',
    date: '02/01/2024',
    author: 'Admin',
    content: '<p>Estamos trabalhando para trazer todas as informações do servidor Tibia Relic para você!</p>',
  },
  {
    id: '2',
    title: 'Tibia Relic - O Servidor',
    date: '01/01/2024',
    author: 'Admin',
    content: '<p>Tibia Relic é um servidor OT que traz a nostalgia do Tibia clássico.</p>',
  },
];

const AdminPage = () => {
  const { toast } = useToast();
  const [news, setNews] = useState<NewsItem[]>(initialNews);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
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

  const handleSave = () => {
    if (!formData.title || !formData.content) {
      toast({
        title: 'Erro',
        description: 'Título e conteúdo são obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    if (isAdding) {
      const newItem: NewsItem = {
        id: Date.now().toString(),
        title: formData.title!,
        date: formData.date!,
        author: formData.author!,
        content: formData.content!,
      };
      setNews([newItem, ...news]);
      toast({
        title: 'Sucesso',
        description: 'Notícia adicionada com sucesso!',
      });
    } else if (editingId) {
      setNews(news.map(item => 
        item.id === editingId 
          ? { ...item, ...formData } as NewsItem 
          : item
      ));
      toast({
        title: 'Sucesso',
        description: 'Notícia atualizada com sucesso!',
      });
    }

    setIsAdding(false);
    setEditingId(null);
    setFormData({});
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({});
  };

  const handleDelete = (id: string) => {
    setNews(news.filter(item => item.id !== id));
    toast({
      title: 'Sucesso',
      description: 'Notícia removida com sucesso!',
    });
  };

  return (
    <MainLayout showSidebars={false}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="news-box">
          <header className="news-box-header">
            <h1 className="font-semibold">Painel Administrativo</h1>
          </header>
          <div className="news-box-content">
            <p className="text-sm mb-4">
              Gerencie as notícias e conteúdo da fan page. As alterações são salvas localmente.
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>Nota:</strong> Para persistência permanente, conecte o Lovable Cloud para salvar no banco de dados.
            </p>
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
                <Button onClick={handleSave} className="retro-btn flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  Salvar
                </Button>
                <Button onClick={handleCancel} variant="outline" className="flex items-center gap-2">
                  <X className="w-4 h-4" />
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* News List */}
        <div className="space-y-4">
          <h2 className="font-heading text-lg text-gold">Notícias Cadastradas</h2>
          
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
      </div>
    </MainLayout>
  );
};

export default AdminPage;
