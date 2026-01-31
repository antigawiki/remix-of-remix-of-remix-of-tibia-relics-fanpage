
# Plano: Sistema de Idiomas e Tema (Claro/Escuro)

## Resumo

Implementar duas funcionalidades no site:
1. **Seletor de Idioma**: Português, Inglês, Espanhol e Polonês
2. **Seletor de Tema**: Modo atual (claro) e Dark Mode

## Localização dos Controles

Os controles serão adicionados no **Footer** do site, em uma área discreta mas acessível em todas as páginas. Alternativamente, podem ficar no Header se preferir.

```text
┌─────────────────────────────────────────────────────────────┐
│                         FOOTER                               │
├─────────────────────────────────────────────────────────────┤
│  Desenvolvido por Josuba    │  [🌐 PT ▼] [🌙/☀️]  │  tibiarelic.com │
└─────────────────────────────────────────────────────────────┘
```

---

## Parte 1: Sistema de Tema (Dark Mode)

### 1.1 O que será feito

- Usar a biblioteca `next-themes` que já está instalada
- Criar um `ThemeProvider` no App
- Adicionar botão toggle no Footer para alternar entre temas
- O CSS já tem classes `.dark` definidas no `index.css`

### 1.2 Comportamento

- O tema será salvo no `localStorage` para persistir entre sessões
- Ícone de lua (🌙) para ativar dark mode
- Ícone de sol (☀️) para ativar light mode

---

## Parte 2: Sistema de Idiomas (i18n)

### 2.1 Estrutura de Arquivos

```text
src/
├── i18n/
│   ├── index.ts              # Context e hooks
│   ├── translations/
│   │   ├── pt.ts             # Português (padrão)
│   │   ├── en.ts             # Inglês
│   │   ├── es.ts             # Espanhol
│   │   └── pl.ts             # Polonês
│   └── types.ts              # Tipagem das traduções
```

### 2.2 Idiomas Suportados

| Código | Idioma    | Bandeira |
|--------|-----------|----------|
| pt     | Português | 🇧🇷      |
| en     | English   | 🇺🇸      |
| es     | Español   | 🇪🇸      |
| pl     | Polski    | 🇵🇱      |

### 2.3 Categorias de Texto a Traduzir

1. **Navegação**
   - Menu principal (Início, Equipamentos, Magias, Criaturas, etc.)
   - Sidebar (Links rápidos, Navegação)
   - Breadcrumbs

2. **Páginas Principais**
   - Títulos de seções
   - Descrições
   - Mensagens de erro/sucesso

3. **Componentes**
   - Tabelas (cabeçalhos, placeholders de busca)
   - Calculadoras (labels, botões, resultados)
   - Modais (títulos, botões)

4. **Dados Dinâmicos**
   - Nomes de vocações
   - Categorias de equipamentos
   - Atributos de itens

### 2.4 Hook de Tradução

```typescript
// Exemplo de uso
const { t, language, setLanguage } = useTranslation();

return (
  <h1>{t('navigation.home')}</h1>  // "Início" ou "Home"
);
```

---

## Componentes a Criar

| Componente | Descrição |
|------------|-----------|
| `src/contexts/ThemeContext.tsx` | Provider do tema usando next-themes |
| `src/i18n/index.ts` | Context e hook de tradução |
| `src/i18n/translations/*.ts` | Arquivos de tradução por idioma |
| `src/components/LanguageSelector.tsx` | Dropdown de seleção de idioma |
| `src/components/ThemeToggle.tsx` | Botão toggle de tema |

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/App.tsx` | Adicionar ThemeProvider e LanguageProvider |
| `src/components/Footer.tsx` | Adicionar seletores de idioma e tema |
| `src/components/Header.tsx` | Substituir textos por `t('chave')` |
| `src/components/Sidebar.tsx` | Substituir textos por `t('chave')` |
| `src/components/Breadcrumb.tsx` | Usar traduções dinâmicas |
| `src/pages/*.tsx` | Substituir textos hardcoded |
| `src/components/*.tsx` | Substituir textos hardcoded |

---

## Exemplo de Arquivo de Tradução

```typescript
// src/i18n/translations/pt.ts
export const pt = {
  navigation: {
    home: 'Início',
    equipment: 'Equipamentos',
    spells: 'Magias',
    creatures: 'Criaturas',
    quests: 'Quests',
    calculators: 'Calculadoras',
    info: 'Informações',
    ranking: 'Ranking',
    online: 'Players Online',
    banned: 'Banidos',
    topGainers: 'Top Gainers',
  },
  common: {
    search: 'Buscar',
    loading: 'Carregando...',
    error: 'Erro',
    notFound: 'Não encontrado',
    back: 'Voltar',
  },
  // ... mais categorias
};
```

---

## Persistência

- **Tema**: Salvo automaticamente pelo `next-themes` no `localStorage`
- **Idioma**: Salvo no `localStorage` com chave `preferred-language`

---

## Ordem de Implementação

1. Configurar ThemeProvider com next-themes
2. Criar ThemeToggle e adicionar ao Footer
3. Criar estrutura de i18n (context, types, hook)
4. Criar arquivo de tradução base (pt.ts)
5. Criar arquivos de tradução (en.ts, es.ts, pl.ts)
6. Criar LanguageSelector
7. Adicionar LanguageSelector ao Footer
8. Migrar textos dos componentes principais
9. Migrar textos das páginas
10. Testar funcionamento completo

---

## Seção Técnica

### Implementação do Context de Idioma

```typescript
// src/i18n/index.ts
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { pt } from './translations/pt';
import { en } from './translations/en';
import { es } from './translations/es';
import { pl } from './translations/pl';

type Language = 'pt' | 'en' | 'es' | 'pl';
type Translations = typeof pt;

const translations: Record<Language, Translations> = { pt, en, es, pl };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('preferred-language');
    return (saved as Language) || 'pt';
  });

  useEffect(() => {
    localStorage.setItem('preferred-language', language);
  }, [language]);

  const t = (key: string): string => {
    const keys = key.split('.');
    let value: any = translations[language];
    for (const k of keys) {
      value = value?.[k];
    }
    return value ?? key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: setLanguageState, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useTranslation must be used within LanguageProvider');
  return context;
};
```

### Implementação do ThemeProvider

```typescript
// src/contexts/ThemeContext.tsx
import { ThemeProvider as NextThemeProvider } from 'next-themes';
import { ReactNode } from 'react';

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      {children}
    </NextThemeProvider>
  );
}
```

### Componente ThemeToggle

```typescript
// src/components/ThemeToggle.tsx
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  
  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="p-2 rounded hover:bg-muted/50 transition-colors"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 text-gold" />
      ) : (
        <Moon className="w-4 h-4 text-muted-foreground" />
      )}
    </button>
  );
}
```

---

## Considerações

- O sistema é totalmente client-side, sem necessidade de backend
- As traduções serão bundladas no JavaScript final
- A mudança de idioma é instantânea sem reload da página
- O tema segue as variáveis CSS já definidas no projeto
