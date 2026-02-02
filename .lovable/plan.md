
# Plano: Detecção Automática de Idioma do Navegador

## Resumo

Sim, é totalmente possível! Vou implementar a detecção automática do idioma do navegador do usuário. O sistema vai:

1. **Primeira visita**: Detectar o idioma do navegador e usar automaticamente
2. **Visitas seguintes**: Respeitar a preferência salva do usuário
3. **Troca manual**: Se o usuário trocar o idioma, essa escolha é preservada

---

## Como Funciona

O navegador disponibiliza o idioma através de `navigator.language` ou `navigator.languages`. Exemplos:
- Brasileiro: `pt-BR` → detecta `pt`
- Americano: `en-US` → detecta `en`
- Espanhol: `es-ES` → detecta `es`
- Polonês: `pl-PL` → detecta `pl`

---

## Alteração Necessária

**Arquivo**: `src/i18n/index.tsx`

### Código Atual (linhas 18-27):
```typescript
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('preferred-language');
      if (saved && ['pt', 'en', 'es', 'pl'].includes(saved)) {
        return saved as Language;
      }
    }
    return 'pt'; // Sempre retorna português como padrão
  });
```

### Código Novo:
```typescript
const supportedLanguages: Language[] = ['pt', 'en', 'es', 'pl'];

// Detecta o idioma do navegador
const detectBrowserLanguage = (): Language => {
  if (typeof window === 'undefined') return 'pt';
  
  // navigator.languages retorna array de preferências, navigator.language retorna o principal
  const browserLanguages = navigator.languages || [navigator.language];
  
  for (const browserLang of browserLanguages) {
    // Extrai o código do idioma (ex: "pt-BR" -> "pt", "en-US" -> "en")
    const langCode = browserLang.split('-')[0].toLowerCase();
    
    if (supportedLanguages.includes(langCode as Language)) {
      return langCode as Language;
    }
  }
  
  // Fallback para português se nenhum idioma suportado for encontrado
  return 'pt';
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      // 1. Primeiro verifica se o usuário já escolheu um idioma manualmente
      const saved = localStorage.getItem('preferred-language');
      if (saved && supportedLanguages.includes(saved as Language)) {
        return saved as Language;
      }
      
      // 2. Se não, detecta o idioma do navegador
      return detectBrowserLanguage();
    }
    return 'pt';
  });
```

---

## Comportamento Final

| Situação | Resultado |
|----------|-----------|
| Usuário BR (primeira visita) | Site carrega em Português |
| Usuário US (primeira visita) | Site carrega em Inglês |
| Usuário ES (primeira visita) | Site carrega em Espanhol |
| Usuário PL (primeira visita) | Site carrega em Polonês |
| Usuário FR (primeira visita) | Site carrega em Português (fallback) |
| Usuário que já trocou idioma | Mantém a escolha salva |

---

## Resumo da Implementação

| Item | Detalhes |
|------|----------|
| Arquivo modificado | 1 (`src/i18n/index.tsx`) |
| Linhas alteradas | ~15 linhas |
| Risco | Baixo (apenas lógica de inicialização) |
| Dependências | Nenhuma (usa APIs nativas do navegador) |

A detecção é instantânea e acontece antes do site renderizar, então o usuário já vê o conteúdo no idioma correto desde o primeiro carregamento.
