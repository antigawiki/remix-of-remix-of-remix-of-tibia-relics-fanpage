
# Plano: Sistema de Quests com Internacionalização

## Resumo

Criar um sistema completo de quests incluindo:
1. **Página de Lista de Quests** (`/quests`) - Grid com cards de quests disponíveis
2. **Página de Quest Individual** (`/quests/:questSlug`) - Detalhes completos da quest
3. **Primeira Quest**: "Explorer Society / Acesso a Ankrahmun"
4. **Traduções** em todos os 4 idiomas (PT, EN, ES, PL)

---

## Estrutura Visual (Baseada na Referência)

A página de quest individual terá seções semelhantes ao estilo TibiaWiki:

```text
┌─────────────────────────────────────────────────────────────────┐
│  Explorer Society / Acesso a Ankrahmun                          │
├─────────────────────────────────────────────────────────────────┤
│  REQUERIMENTOS                                                   │
│  • 1 Pick                                                       │
│  • Itens/Suprimentos para matar alguns beholders                │
├─────────────────────────────────────────────────────────────────┤
│  INÍCIO DA QUEST                                                 │
│  Texto explicativo + Link para mapa modal                       │
│  [Imagem do NPC Mortimer]                                       │
├─────────────────────────────────────────────────────────────────┤
│  CONVERSA                                                        │
│  ┌────────────────────────────────────────────┐                 │
│  │ [Avatar] Jogador: hi                        │                 │
│  │ [Avatar] Mortimer: Greetings, what can...   │                 │
│  └────────────────────────────────────────────┘                 │
├─────────────────────────────────────────────────────────────────┤
│  PRÓXIMO PASSO                                                   │
│  Texto + Galeria de imagens clicáveis (thumbnails)              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Estrutura de Arquivos

```text
src/
├── data/
│   └── quests/
│       ├── index.ts                    # Lista de todas as quests
│       └── explorerSocietyAnkrahmun.ts # Dados da primeira quest
├── pages/
│   ├── QuestsPage.tsx                  # Lista de quests (atualizar)
│   └── QuestDetailPage.tsx             # Página de quest individual (criar)
├── components/
│   ├── QuestCard.tsx                   # Card de quest para lista
│   ├── QuestDialogue.tsx               # Componente de diálogo NPC/Player
│   └── ImageGallery.tsx                # Galeria de imagens com modal
├── i18n/
│   └── translations/
│       ├── pt.ts                       # Adicionar seção 'quests'
│       ├── en.ts
│       ├── es.ts
│       └── pl.ts
└── public/
    └── quests/
        └── explorer-society/           # Imagens da quest
            ├── mortimer-location.jpg
            ├── dragon-necklace-1.jpg
            ├── dragon-necklace-2.jpg
            ├── dragon-necklace-3.jpg
            ├── dragon-necklace-4.jpg
            ├── caleb-location.jpg
            ├── caleb-body.jpg
            ├── kazzan-location.jpg
            └── passage-door.jpg
```

---

## Componentes a Criar

### 1. QuestCard.tsx
Card visual para exibir quest na lista, mostrando:
- Título da quest
- Nível recomendado (se houver)
- Breve descrição
- Status (Disponível, Em Breve, etc.)

### 2. QuestDialogue.tsx
Componente para exibir diálogos NPC/Jogador no estilo wiki:
- Avatar do NPC (ícone genérico ou específico)
- Nome destacado (NPC em cor diferente do jogador)
- Texto do diálogo

### 3. ImageGallery.tsx
Galeria de imagens com:
- Thumbnails em tamanho reduzido
- Modal para visualização em tamanho real ao clicar
- Navegação entre imagens

---

## Dados da Quest

### Estrutura de Dados

```typescript
interface Quest {
  id: string;
  slug: string;
  title: TranslatedText;
  description: TranslatedText;
  level?: number;
  premium?: boolean;
  requirements: {
    items: TranslatedText[];
    quests?: string[];
    other?: TranslatedText[];
  };
  rewards?: TranslatedText[];
  sections: QuestSection[];
}

interface QuestSection {
  type: 'text' | 'dialogue' | 'images' | 'map';
  title?: TranslatedText;
  content: TranslatedText | DialogueLine[] | string[];
  mapCoordinates?: { x: number; y: number; z: number; zoom?: number };
}

interface DialogueLine {
  speaker: 'player' | string; // 'player' ou nome do NPC
  text: string;
}
```

---

## Rotas

| Rota | Página | Descrição |
|------|--------|-----------|
| `/quests` | QuestsPage | Lista de todas as quests |
| `/quests/:slug` | QuestDetailPage | Detalhes de uma quest específica |

---

## Traduções a Adicionar

```typescript
quests: {
  title: 'Quests',
  requirements: 'Requerimentos',
  startLocation: 'Início da Quest',
  conversation: 'Conversa',
  nextStep: 'Próximo Passo',
  rewards: 'Recompensas',
  player: 'Jogador',
  clickToEnlarge: 'Clique para ampliar',
  backToList: 'Voltar para lista',
  recommended: 'Recomendado',
  premium: 'Premium',
  available: 'Disponível',
  comingSoon: 'Em Breve',
  // Textos específicos da quest Explorer Society
  explorerSociety: {
    title: 'Explorer Society / Acesso a Ankrahmun',
    description: 'Ajude a Explorer Society e ganhe acesso à cidade de Ankrahmun',
    // ... textos da quest
  }
}
```

---

## Fluxo de Implementação

1. **Preparar imagens**
   - Copiar imagens do documento para `public/quests/explorer-society/`

2. **Criar estrutura de dados**
   - `src/data/quests/index.ts`
   - `src/data/quests/explorerSocietyAnkrahmun.ts`

3. **Criar componentes auxiliares**
   - `src/components/QuestDialogue.tsx`
   - `src/components/ImageGallery.tsx`
   - `src/components/QuestCard.tsx`

4. **Atualizar traduções**
   - Adicionar namespace `quests` em todos os 4 arquivos de idioma
   - Atualizar `src/i18n/types.ts`

5. **Criar página de detalhes**
   - `src/pages/QuestDetailPage.tsx`

6. **Atualizar página de lista**
   - Modificar `src/pages/QuestsPage.tsx` para mostrar grid de quests

7. **Adicionar rota**
   - Atualizar `src/App.tsx` com rota `/quests/:slug`

---

## Seção Técnica

### Componente QuestDialogue

```tsx
interface DialogueLine {
  speaker: 'player' | string;
  text: string;
}

const QuestDialogue = ({ lines }: { lines: DialogueLine[] }) => {
  return (
    <div className="space-y-2 bg-secondary/30 rounded-sm p-4 border border-border">
      {lines.map((line, index) => (
        <div key={index} className="flex gap-2">
          <span className={cn(
            "font-semibold min-w-[80px]",
            line.speaker === 'player' ? "text-maroon" : "text-gold"
          )}>
            {line.speaker === 'player' ? t('quests.player') : line.speaker}:
          </span>
          <span className="text-text-dark">{line.text}</span>
        </div>
      ))}
    </div>
  );
};
```

### Componente ImageGallery

```tsx
const ImageGallery = ({ images, alt }: { images: string[]; alt: string }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {images.map((src, i) => (
          <button 
            key={i}
            onClick={() => setSelectedImage(src)}
            className="aspect-video overflow-hidden rounded-sm border border-border hover:border-gold transition-colors"
          >
            <img src={src} alt={`${alt} ${i + 1}`} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
      
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl">
          <img src={selectedImage!} alt={alt} className="w-full h-auto" />
        </DialogContent>
      </Dialog>
    </>
  );
};
```

### Link para Mapa com Modal

Reutilizar o componente `MapModal` existente para abrir coordenadas:
- Mortimer: `#32500,31626,7:3`
- Kazzan em Darashia: usar coordenadas apropriadas

---

## Imagens do Documento

As seguintes imagens serão extraídas e usadas:

| Imagem | Uso |
|--------|-----|
| img_p0_1.jpg | Localização do Mortimer |
| img_p2_1.jpg | Dragon Necklace quest passo 1 |
| img_p3_1.jpg | Dragon Necklace quest passo 2 |
| img_p4_1.jpg | Dragon Necklace quest passo 3 |
| img_p4_2.jpg | Dragon Necklace quest passo 4 |
| img_p5_1.jpg | Entrega do Dragon Necklace |
| img_p6_1.jpg | Localização do Caleb (Venore) |
| img_p6_2.jpg | Corpo do Caleb |
| img_p8_1.jpg | Passagem liberada para Ankrahmun |

---

## Resultado Esperado

1. **Página `/quests`**: Grid com card da quest "Explorer Society / Acesso a Ankrahmun"
2. **Página `/quests/explorer-society-ankrahmun`**: Guia completo com:
   - Requerimentos listados
   - Texto explicativo com links para mapa
   - Diálogos formatados (NPC/Jogador)
   - Galeria de imagens clicáveis
   - Todas as etapas da quest documentadas
3. **Multi-idioma**: Todo o conteúdo traduzido em PT, EN, ES e PL
