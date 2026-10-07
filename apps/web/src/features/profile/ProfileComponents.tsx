import { useEffect, useRef, useState } from 'react'
import { api, json, nameOf, type Person } from '../../api'
import { Avatar } from '../../components/atoms/Avatar'
import { Icon } from '../../components/atoms/Icon'
import { TextInput } from '../../components/atoms/TextInput'
import { FormField } from '../../components/molecules/FormField'
import { NameDayFields } from '../../components/molecules/NameDayFields'
import { LanguageControl } from '../../language'
import { useTranslation } from '../../language-context'
import { readNameDay } from '../families/form-data'

export function ProfileMenu({ me, busy, onProfile, onLogout }: { me: Person; busy: boolean; onProfile: () => void; onLogout: () => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() } }
    const onClick = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('keydown', onKey); document.addEventListener('mousedown', onClick)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick) }
  }, [open])
  return <div className="relative" ref={ref}>
    <button ref={trigger} className="flex items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-brand-50" aria-haspopup="true" aria-expanded={open} aria-controls="account-menu" aria-label={t('Menu du compte')} onClick={() => setOpen(value => !value)}>
      <Avatar person={me} size="sm"/><span className="hidden max-w-[140px] truncate text-sm font-semibold sm:block">{nameOf(me)}</span><Icon name="chevron" size={14} className={`transition ${open ? '-rotate-90' : 'rotate-90'}`}/>
    </button>
    {open && <div id="account-menu" className="absolute right-0 top-12 z-30 w-64 rounded-2xl border border-line bg-white p-2 shadow-xl">
      <div className="border-b border-line-soft px-3 pb-3 pt-2"><p className="truncate font-semibold">{nameOf(me)}</p>{me.email && <p className="muted truncate">{me.email}</p>}</div>
      <button className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-brand-50" onClick={() => { setOpen(false); onProfile() }}><Icon name="user" size={18}/>{t('Mon profil')}</button>
      <div className="px-3 py-2.5"><LanguageControl/></div>
      <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-brand-50" disabled={busy} onClick={() => { setOpen(false); onLogout() }}><Icon name="logout" size={18}/>{t('Se déconnecter')}</button>
    </div>}
  </div>
}

// A name day is a day in the year, stored as MM-DD: it repeats, so it carries no year. The two
// halves travel together in the form, which is why reading them back is shared too.
export function ProfileForm({ me, busy, perform, onSaved }: {
  me: Person; busy: boolean;
  perform: (action: () => Promise<unknown>, success: string, close?: boolean) => Promise<boolean>; onSaved: (person: Person) => void
}) {
  const { t } = useTranslation()
  return <form className="space-y-4 border-t border-line pt-6" onSubmit={event => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    void perform(async () => {
      const person = await api<Person>('/profile', json('PATCH', {
        firstName: String(data.get('firstName')).trim(), lastName: String(data.get('lastName')).trim(),
        nameDay: readNameDay(data, t('Choisissez le jour et le mois de votre fête.')),
      }))
      onSaved(person)
    }, t('Profil mis à jour.'), false)
  }}>
    <h3 className="font-['Outfit'] text-lg font-semibold">{t('Modifier mon profil')}</h3>
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField id="profile-first-name" label={t('Prénom')}><TextInput id="profile-first-name" name="firstName" defaultValue={me.firstName} required/></FormField>
      <FormField id="profile-last-name" label={t('Nom')}><TextInput id="profile-last-name" name="lastName" defaultValue={me.lastName} required/></FormField>
    </div>
    <NameDayFields idPrefix="profile" value={me.nameDay} hint={t('Utilisée pour l’occasion « Fête » dans vos familles.')}/>
    <button disabled={busy} className="primary">{t('Enregistrer')}</button>
  </form>
}
