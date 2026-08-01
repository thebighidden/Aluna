'use client';

import { Languages } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export type Language = 'en' | 'fr' | 'ar';
export type VisibleLanguage = Exclude<Language, 'fr'>;

export type LocalizedText = Record<Language, string>;

const languageStorageKey = 'aluna-language';

export function useLanguagePreference() {
  const [language, setLanguage] = useState<VisibleLanguage>('en');

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem(languageStorageKey);
    const initialLanguage: VisibleLanguage = savedLanguage === 'ar' ? 'ar' : 'en';

    setLanguage(initialLanguage);
    document.documentElement.lang = initialLanguage;
    document.documentElement.dir = initialLanguage === 'ar' ? 'rtl' : 'ltr';
  }, []);

  const changeLanguage = useCallback((nextLanguage: VisibleLanguage) => {
    setLanguage(nextLanguage);
    window.localStorage.setItem(languageStorageKey, nextLanguage);
    document.documentElement.lang = nextLanguage;
    document.documentElement.dir = nextLanguage === 'ar' ? 'rtl' : 'ltr';
  }, []);

  return [language, changeLanguage] as const;
}

export function LanguageToggle({
  language,
  label,
  onChange,
}: {
  language: VisibleLanguage;
  label: string;
  onChange: (language: VisibleLanguage) => void;
}) {
  const nextLanguage: VisibleLanguage = language === 'en' ? 'ar' : 'en';
  const nextLanguageLabel = nextLanguage === 'ar' ? 'العربية — الدارجة' : 'English';

  return (
    <button
      aria-label={`${label}: ${nextLanguageLabel}`}
      className="language-toggle"
      onClick={() => onChange(nextLanguage)}
      title={nextLanguageLabel}
      type="button"
    >
      <Languages aria-hidden="true" size={18} strokeWidth={1.8} />
    </button>
  );
}
