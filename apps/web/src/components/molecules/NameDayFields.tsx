import { useTranslation } from '../../language-context'

export function NameDayFields({ idPrefix, value, hint }: { idPrefix: string; value?: string | null; hint: string }) {
  const { locale, t } = useTranslation()
  const months = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, index, 1))))
  const [month, day] = value ? value.split('-') : ['', '']
  return <fieldset>
    <legend className="label">{t('Date de fête')}</legend>
    <p className="muted mb-2">{hint}</p>
    <div className="flex flex-wrap gap-2">
      <label className="sr-only" htmlFor={`${idPrefix}-name-day-day`}>{t('Jour')}</label>
      <select className="field !w-auto" id={`${idPrefix}-name-day-day`} name="nameDayDay" defaultValue={day}><option value="">{t('Jour')}</option>{Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, '0')).map(value => <option key={value} value={value}>{Number(value)}</option>)}</select>
      <label className="sr-only" htmlFor={`${idPrefix}-name-day-month`}>{t('Mois')}</label>
      <select className="field !w-auto" id={`${idPrefix}-name-day-month`} name="nameDayMonth" defaultValue={month}><option value="">{t('Mois')}</option>{months.map((label, index) => <option key={label} value={String(index + 1).padStart(2, '0')}>{label}</option>)}</select>
    </div>
  </fieldset>
}
