import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, TranslationKeys } from './types';
import { pt } from './translations/pt';
import { en } from './translations/en';
import { es } from './translations/es';
import { pl } from './translations/pl';

const translations: Record<Language, TranslationKeys> = { pt, en, es, pl };
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

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

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

  useEffect(() => {
    localStorage.setItem('preferred-language', language);
    document.documentElement.lang = language;
  }, [language]);

  const t = (key: string): string => {
    const keys = key.split('.');
    let value: unknown = translations[language];
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return key; // Return key if translation not found
      }
    }
    
    return typeof value === 'string' ? value : key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: setLanguageState, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within LanguageProvider');
  }
  return context;
};

export type { Language, TranslationKeys };
