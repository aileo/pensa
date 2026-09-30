import { createContext, useCallback, useContext } from 'react'
import { translate, type Locale, type TranslationKey } from './locale'

export const LocaleContext = createContext<{ locale: Locale; setLocale: (locale: Locale) => void }>({ locale: 'fr', setLocale: () => {} })

export function useTranslation() {
  const { locale, setLocale } = useContext(LocaleContext)
  const t = useCallback((key: TranslationKey, values?: Record<string, string | number>) => translate(key, locale, values), [locale])
  return { locale, setLocale, t }
}
