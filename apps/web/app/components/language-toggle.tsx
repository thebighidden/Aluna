'use client';

import { Languages } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export type Language = 'en' | 'fr';

export type LocalizedText = Record<Language, string>;

const languageStorageKey = 'aluna-language';

export function useLanguagePreference() {
  const [language, setLanguage] = useState<Language>('en');

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem(languageStorageKey);
    const initialLanguage: Language = savedLanguage === 'fr' ? 'fr' : 'en';

    setLanguage(initialLanguage);
    document.documentElement.lang = initialLanguage;
  }, []);

  const changeLanguage = useCallback((nextLanguage: Language) => {
    setLanguage(nextLanguage);
    window.localStorage.setItem(languageStorageKey, nextLanguage);
    document.documentElement.lang = nextLanguage;
  }, []);

  return [language, changeLanguage] as const;
}

export function LanguageToggle({
  language,
  label,
  onChange,
}: {
  language: Language;
  label: string;
  onChange: (language: Language) => void;
}) {
  const nextLanguage: Language = language === 'en' ? 'fr' : 'en';

  return (
    <button
      aria-label={`${label}: ${nextLanguage === 'fr' ? 'Français' : 'English'}`}
      className="language-toggle"
      onClick={() => onChange(nextLanguage)}
      title={nextLanguage === 'fr' ? 'Français' : 'English'}
      type="button"
    >
      <Languages aria-hidden="true" size={18} strokeWidth={1.8} />
    </button>
  );
}
