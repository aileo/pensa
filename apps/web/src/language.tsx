import { useEffect, useState, type ReactNode } from 'react'
import { activateLocale, getLocale, saveLocale, type Locale } from './locale'
import { LocaleContext, useTranslation } from './language-context'

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(getLocale)
  useEffect(() => {
    activateLocale(locale)
    document.documentElement.lang = locale
    document.title = locale === 'fr' ? 'Giftit — Le bonheur d’offrir ensemble' : 'Giftit — The joy of giving together'
    document.querySelector('meta[name="description"]')?.setAttribute('content', locale === 'fr' ? 'Giftit, le bonheur d’offrir ensemble.' : 'Giftit, the joy of giving together.')
  }, [locale])
  function changeLocale(next: Locale) {
    saveLocale(next)
    setLocale(next)
  }
  return <LocaleContext.Provider value={{ locale, setLocale: changeLocale }}>{children}</LocaleContext.Provider>
}

export function LanguageControl() {
  const { locale, setLocale } = useTranslation()
  return <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#635375]">
    <span>{locale === 'fr' ? 'Langue' : 'Language'}</span>
    <select className="field !w-auto !py-1.5" aria-label={locale === 'fr' ? 'Choisir la langue' : 'Choose language'} value={locale} onChange={event => setLocale(event.target.value as Locale)}>
      <option value="fr">Français</option><option value="en">English</option>
    </select>
  </label>
}
