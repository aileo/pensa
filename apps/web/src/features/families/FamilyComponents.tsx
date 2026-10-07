import { useState, type ReactNode } from 'react'
import { api, json, nameOf, type Family, type Household, type Id, type Occasion, type Person } from '../../api'
import { Avatar } from '../../components/atoms/Avatar'
import { SelectInput } from '../../components/atoms/SelectInput'
import { TextInput } from '../../components/atoms/TextInput'
import { Icon } from '../../components/atoms/Icon'
import { FormField } from '../../components/molecules/FormField'
import { NameDayFields } from '../../components/molecules/NameDayFields'
import { readNameDay } from './form-data'
import { useTranslation } from '../../language-context'

export function OccasionForm({ family, busy, perform }: { family: Family; busy: boolean; perform: (action: () => Promise<unknown>, success: string) => Promise<boolean> }) {
  const { t } = useTranslation()
  const [kind, setKind] = useState<Occasion['kind']>('fixed')
  return <form onSubmit={event => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const body = { name: String(data.get('name')).trim(), kind, ...(kind === 'fixed' ? { month: Number(data.get('month')), day: Number(data.get('day')) } : {}) }
    void perform(() => api(`/families/${family.id}/occasions`, json('POST', body)), t('Occasion créée.'))
  }}>
    <FormField id="occasion-name" label={t('Nom de l’occasion')}><TextInput className="mb-4" id="occasion-name" name="name" placeholder={t('Ex. : Noël')} required/></FormField>
    <FormField id="occasion-kind" label={t('Type d’occasion')}><SelectInput className="mb-4" id="occasion-kind" value={kind} onChange={event => setKind(event.target.value as Occasion['kind'])}>
      <option value="fixed">{t('Date fixe')}</option><option value="birthday">{t('Anniversaire (date de naissance)')}</option><option value="name_day">{t('Fête du prénom')}</option>
    </SelectInput></FormField>
    {kind === 'fixed' && <div className="grid grid-cols-2 gap-3"><FormField id="occasion-day" label={t('Jour')}><TextInput id="occasion-day" name="day" type="number" min="1" max="31" required/></FormField><FormField id="occasion-month" label={t('Mois')}><TextInput id="occasion-month" name="month" type="number" min="1" max="12" required/></FormField></div>}
    {kind !== 'fixed' && <p className="muted">{t('La date est calculée à partir du profil de la personne lorsqu’elle est disponible.')}</p>}
    <button disabled={busy} className="primary mt-5 w-full">{t('Créer l’occasion')}</button>
  </form>
}

export function JoinFamily({ busy, perform }: { busy: boolean; perform: (action: () => Promise<unknown>, success: string, close?: boolean) => Promise<boolean> }) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  return <section className="card mt-8 p-5 sm:p-6">
    <h3 className="font-['Outfit'] text-xl font-semibold">{t('Rejoindre une famille')}</h3>
    <p className="muted mt-2">{t('Saisissez le code d’invitation à la famille reçu de son administrateur pour y rattacher votre foyer.')}</p>
    <form className="mt-4 flex flex-wrap gap-2" onSubmit={event => {
      event.preventDefault()
      void perform(() => api<{ familyId: Id; householdId: Id }>('/families/join', json('POST', { code: code.trim() })), t('Votre foyer a rejoint la famille.'), false).then(ok => { if (ok) setCode('') })
    }}>
      <FormField className="min-w-0 flex-1" id="join-family-code" label={t('Code d’invitation à la famille')} labelClassName="sr-only"><TextInput className="min-w-0 flex-1" id="join-family-code" value={code} onChange={event => setCode(event.target.value)} placeholder={t('Code d’invitation à la famille')} required/></FormField>
      <button className="secondary" disabled={busy || !code.trim()}>{t('Rejoindre la famille')}</button>
    </form>
  </section>
}

export function FamilyManagement({ family, busy, perform, handleError, onRename }: {
  family: Family; busy: boolean;
  perform: (action: () => Promise<unknown>, success: string, close?: boolean) => Promise<boolean>;
  handleError: (error: unknown) => void; onRename: (name: string) => void
}) {
  const { t } = useTranslation()
  const [familyCode, setFamilyCode] = useState('')
  const [generatingFamily, setGeneratingFamily] = useState(false)
  async function inviteFamily() {
    setGeneratingFamily(true); setFamilyCode('')
    try {
      const result = await api<{ code: string }>(`/families/${family.id}/invitations`, json('POST', {}))
      setFamilyCode(result.code)
    } catch (problem) { handleError(problem) }
    finally { setGeneratingFamily(false) }
  }
  return <section className="card mt-8 p-5 sm:p-6" aria-label={t('Administration de {name}', { name: family.name })}>
    <h3 className="font-['Outfit'] text-xl font-semibold">{t('Gérer la famille')}</h3>
    <div className="mt-5 grid gap-6 lg:grid-cols-2">
      <div>
        <p className="label">{t('Inviter un foyer dans cette famille')}</p>
        <p className="muted mb-3">{t('Communiquez ce code à l’administrateur du foyer pour qu’il rejoigne la famille.')}</p>
        <button type="button" disabled={generatingFamily} className="secondary" onClick={() => void inviteFamily()}>{generatingFamily ? t('Création…') : t('Créer un code d’invitation à la famille')}</button>
        {familyCode && <div role="status" className="mt-3 rounded-xl bg-brand-50 p-3"><p className="mb-1 text-sm font-semibold">{t('Code d’invitation à la famille (visible uniquement maintenant)')}</p><output className="block break-all font-mono text-sm text-brand-700">{familyCode}</output></div>}
      </div>
      <form onSubmit={event => {
        event.preventDefault()
        const name = String(new FormData(event.currentTarget).get('name')).trim()
        void perform(() => api(`/families/${family.id}`, json('PATCH', { name })), t('Famille renommée.'), false).then(ok => { if (ok) onRename(name) })
      }}>
        <FormField id="rename-family" label={t('Renommer la famille')}><div className="flex flex-wrap gap-2"><TextInput key={family.name} className="min-w-0 flex-1" id="rename-family" name="name" defaultValue={family.name} required/><button disabled={busy} className="secondary">{t('Renommer')}</button></div></FormField>
      </form>
    </div>
  </section>
}

export function RoleBadges({ person }: { person: Person }) {
  const { t } = useTranslation()
  return <>
    {person.householdAdmin && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">{t('Admin du foyer')}</span>}
    {person.familyAdmin && <span className="rounded-full bg-clay-50 px-2 py-0.5 text-[11px] font-bold text-clay-600">{t('Admin de la famille')}</span>}
    {person.managed && <span className="rounded-full bg-sage-50 px-2 py-0.5 text-[11px] font-bold text-sage-700">{t('Géré par le foyer')}</span>}
  </>
}

export function PersonRow({ person, me, onPerson, children }: { person: Person; me: Person; onPerson: (person: Person) => void; children?: ReactNode }) {
  const { t } = useTranslation()
  const self = String(person.id) === String(me.id)
  return <li className="flex flex-wrap items-center gap-3 py-3">
    <button className="flex min-w-0 flex-1 items-center gap-3 text-left hover:text-brand-700" onClick={() => onPerson(person)} aria-label={self ? t('Voir mes envies') : t('Voir les envies de {name}', { name: nameOf(person) })}>
      <Avatar person={person} size="sm"/>
      <span className="min-w-0"><span className="block truncate font-semibold">{nameOf(person)}{self && <span className="muted font-normal"> {t('(vous)')}</span>}</span><span className="mt-1 flex flex-wrap gap-1"><RoleBadges person={person}/></span></span>
    </button>
    {children}
  </li>
}

export function FamilyHouseholds({ family, me, onPerson }: { family: Family; me: Person; onPerson: (person: Person) => void }) {
  return <div className="grid gap-4 lg:grid-cols-2">{family.households?.map(household => <HouseholdCard key={household.id} household={household} me={me} onPerson={onPerson}/>)}</div>
}

export function HouseholdCard({ household, me, onPerson }: { household: Household; me: Person; onPerson: (person: Person) => void }) {
  const { t } = useTranslation()
  return <article className="card p-5">
    <div className="flex items-center gap-3"><span className="rounded-xl bg-brand-50 p-2 text-brand-600"><Icon name="home" size={19}/></span><h3 className="font-['Outfit'] text-lg font-semibold">{household.name}</h3></div>
    {household.members?.length ? <ul className="mt-2 divide-y divide-line-soft">{household.members.map(member => <PersonRow key={member.id} person={member} me={me} onPerson={onPerson}/>)}</ul> : <p className="muted mt-3">{t('Aucun membre affiché')}</p>}
  </article>
}

export function ManagedMemberActions({ household, member, busy, perform, handleError }: {
  household: Household; member: Person; busy: boolean;
  perform: (action: () => Promise<unknown>, success: string, close?: boolean) => Promise<boolean>; handleError: (error: unknown) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState<'' | 'code' | 'account' | 'edit'>('')
  const [code, setCode] = useState('')
  const path = `/households/${household.id}/members/${member.id}`
  async function claimCode() {
    setOpen('code'); setCode('')
    try { setCode((await api<{ code: string }>(`${path}/invitations`, json('POST', {}))).code) }
    catch (problem) { handleError(problem) }
  }
  return <div className="w-full space-y-3">
    <div className="flex flex-wrap gap-2">
      <button className="secondary !px-3 !py-1.5 text-xs" disabled={busy} onClick={() => setOpen(open === 'edit' ? '' : 'edit')}>{t('Modifier la fiche')}</button>
      <button className="secondary !px-3 !py-1.5 text-xs" disabled={busy} onClick={() => void claimCode()}>{t('Créer un code de rattachement')}</button>
      <button className="secondary !px-3 !py-1.5 text-xs" disabled={busy} onClick={() => setOpen(open === 'account' ? '' : 'account')}>{t('Définir ses identifiants')}</button>
      <button className="secondary !px-3 !py-1.5 text-xs hover:!text-red-600" disabled={busy}
        onClick={() => { if (window.confirm(t('Retirer {name} du foyer ? Sa liste sera supprimée.', { name: nameOf(member) }))) void perform(() => api(path, { method: 'DELETE' }), t('Membre retiré du foyer.'), false) }}>{t('Retirer du foyer')}</button>
    </div>
    {open === 'code' && code && <div role="status" className="rounded-xl bg-brand-50 p-3"><p className="mb-1 text-sm font-semibold">{t('Code de rattachement (visible uniquement maintenant)')}</p><output className="block break-all font-mono text-sm text-brand-700">{code}</output><p className="muted mt-1 text-xs">{t('À saisir sur l’écran de connexion, rubrique « J’ai un code de rattachement ».')}</p></div>}
    {open === 'edit' && <form className="space-y-3 rounded-xl bg-brand-50 p-3" onSubmit={event => {
      event.preventDefault()
      const data = new FormData(event.currentTarget)
      void perform(async () => {
        await api(path, json('PATCH', {
          firstName: String(data.get('firstName')).trim(), lastName: String(data.get('lastName')).trim(),
          birthDate: String(data.get('birthDate')),
          nameDay: readNameDay(data, t('Choisissez le jour et le mois de sa fête.')),
        }))
        setOpen('')
      }, t('Fiche mise à jour.'), false)
    }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor={`first-name-${member.id}`}>{t('Prénom')}</label><input className="field" id={`first-name-${member.id}`} name="firstName" defaultValue={member.firstName} required/></div>
        <div><label className="label" htmlFor={`last-name-${member.id}`}>{t('Nom')}</label><input className="field" id={`last-name-${member.id}`} name="lastName" defaultValue={member.lastName} required/></div>
      </div>
      <div><label className="label" htmlFor={`birth-date-${member.id}`}>{t('Date de naissance')}</label><input className="field" id={`birth-date-${member.id}`} name="birthDate" type="date" defaultValue={member.birthDate ?? ''} required/></div>
      <NameDayFields idPrefix={`member-${member.id}`} value={member.nameDay} hint={t('Facultative. Sans elle, l’occasion « Fête » ne sera pas annoncée pour cette personne.')}/>
      <div className="flex gap-2"><button className="primary" disabled={busy}>{t('Enregistrer')}</button><button type="button" className="secondary" onClick={() => setOpen('')}>{t('Annuler')}</button></div>
    </form>}
    {open === 'account' && <form className="flex flex-wrap items-end gap-2 rounded-xl bg-brand-50 p-3" onSubmit={event => {
      event.preventDefault()
      const data = new FormData(event.currentTarget)
      void perform(() => api(`${path}/account`, json('POST', { email: String(data.get('email')).trim(), password: String(data.get('password')) })), t('Compte créé : cette personne peut se connecter.'), false)
    }}>
      <div className="min-w-0 flex-1"><label className="label" htmlFor={`email-${member.id}`}>{t('Adresse e-mail')}</label><input className="field" id={`email-${member.id}`} name="email" type="email" required/></div>
      <div className="min-w-0 flex-1"><label className="label" htmlFor={`password-${member.id}`}>{t('Mot de passe')}</label><input className="field" id={`password-${member.id}`} name="password" type="password" minLength={12} required/></div>
      <button className="secondary" disabled={busy}>{t('Créer le compte')}</button>
    </form>}
  </div>
}

export function HouseholdPanel({ household, me, isAdmin, busy, perform, handleError, onPerson }: {
  household: Household; me: Person; isAdmin: boolean; busy: boolean;
  perform: (action: () => Promise<unknown>, success: string, close?: boolean) => Promise<boolean>;
  handleError: (error: unknown) => void; onPerson: (person: Person) => void
}) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [generating, setGenerating] = useState(false)
  const [adding, setAdding] = useState(false)
  const members = household.members ?? []
  const adminCount = members.filter(member => member.householdAdmin).length
  async function invite() {
    setGenerating(true); setCode('')
    try { setCode((await api<{ code: string }>(`/households/${household.id}/invitations`, json('POST', {}))).code) }
    catch (problem) { handleError(problem) }
    finally { setGenerating(false) }
  }
  const moveOut = (member: Person) => {
    const self = String(member.id) === String(me.id)
    const question = self
      ? t('Créer votre propre foyer et le quitter ? Vous resterez dans les mêmes familles.')
      : t('Donner son propre foyer à {name} ? Ce foyer restera dans les mêmes familles.', { name: nameOf(member) })
    if (window.confirm(question)) void perform(() => api(`/households/${household.id}/members/${member.id}/move-out`, json('POST', {})), t('Nouveau foyer créé.'), false)
  }
  return <section aria-labelledby="my-household-title">
    <div className="mb-5"><p className="eyebrow mb-1">{t('MON FOYER')}</p><h2 id="my-household-title" className="font-['Outfit'] text-2xl font-semibold tracking-tight text-ink-900">{household.name}</h2><p className="muted mt-1">{t('Les personnes qui vivent avec vous. Votre foyer rejoint les familles ensemble.')}</p></div>
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="card p-5 sm:p-6">
        <h3 className="label">{t('Membres du foyer')}</h3>
        <ul className="divide-y divide-line-soft">{members.map(member => {
          const lastAdmin = member.householdAdmin && adminCount <= 1
          const self = String(member.id) === String(me.id)
          return <PersonRow key={member.id} person={member} me={me} onPerson={onPerson}>
            {isAdmin && !member.managed && <button className="secondary !px-3 !py-1.5 text-xs" disabled={busy || lastAdmin} title={lastAdmin ? t('Un foyer doit conserver un administrateur') : undefined}
              onClick={() => void perform(() => api(`/households/${household.id}/members/${member.id}`, json('PATCH', { admin: !member.householdAdmin })), member.householdAdmin ? t('Droits d’admin retirés.') : t('Droits d’admin accordés.'), false)}>
              {member.householdAdmin ? t('Retirer l’admin') : t('Nommer admin')}</button>}
            {!member.managed && (self || isAdmin) && members.length > 1 && <button className="secondary !px-3 !py-1.5 text-xs" disabled={busy || lastAdmin} title={lastAdmin ? t('Un foyer doit conserver un administrateur') : undefined} onClick={() => moveOut(member)}>
              {self ? t('Quitter ce foyer') : t('Lui donner son foyer')}</button>}
            {isAdmin && member.managed && <ManagedMemberActions household={household} member={member} busy={busy} perform={perform} handleError={handleError}/>}
          </PersonRow>
        })}</ul>
        {isAdmin && <div className="mt-4 border-t border-line-soft pt-4">
          {adding ? <form className="space-y-3" onSubmit={event => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            void perform(async () => {
              await api(`/households/${household.id}/members`, json('POST', {
                firstName: String(data.get('firstName')).trim(), lastName: String(data.get('lastName')).trim(),
                birthDate: String(data.get('birthDate')),
                nameDay: readNameDay(data, t('Choisissez le jour et le mois de sa fête.')),
              }))
              setAdding(false)
            }, t('Membre ajouté au foyer.'), false)
          }}>
            <p className="muted">{t('Pour un enfant ou toute personne sans compte : votre foyer tient sa liste à sa place.')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label" htmlFor="member-first-name">{t('Prénom')}</label><input className="field" id="member-first-name" name="firstName" required/></div>
              <div><label className="label" htmlFor="member-last-name">{t('Nom')}</label><input className="field" id="member-last-name" name="lastName" required/></div>
            </div>
            <div><label className="label" htmlFor="member-birth-date">{t('Date de naissance')}</label><input className="field" id="member-birth-date" name="birthDate" type="date" required/></div>
            <NameDayFields idPrefix="member" hint={t('Facultative. Sans elle, l’occasion « Fête » ne sera pas annoncée pour cette personne.')}/>
            <div className="flex gap-2"><button className="primary" disabled={busy}>{t('Ajouter au foyer')}</button><button type="button" className="secondary" onClick={() => setAdding(false)}>{t('Annuler')}</button></div>
          </form> : <button className="secondary" onClick={() => setAdding(true)}><Icon name="plus" size={17}/> {t('Ajouter un membre sans compte')}</button>}
        </div>}
      </div>
      {isAdmin ? <div className="card space-y-6 p-5 sm:p-6">
        <form onSubmit={event => {
          event.preventDefault()
          const name = String(new FormData(event.currentTarget).get('name')).trim()
          if (name) void perform(() => api(`/households/${household.id}`, json('PATCH', { name })), t('Foyer renommé.'), false)
        }}>
          <label className="label" htmlFor="rename-household">{t('Renommer le foyer')}</label>
          <div className="flex flex-wrap gap-2"><input key={household.name} className="field min-w-0 flex-1" id="rename-household" name="name" defaultValue={household.name} required/><button disabled={busy} className="secondary">{t('Renommer')}</button></div>
        </form>
        <div>
          <p className="label">{t('Inviter dans mon foyer')}</p>
          <p className="muted mb-3">{t('Générez un code valable 7 jours, à communiquer à la personne invitée pour son inscription.')}</p>
          <button type="button" disabled={generating} className="secondary" onClick={() => void invite()}>{generating ? t('Création…') : t('Créer un code d’invitation au foyer')}</button>
          {code && <div role="status" className="mt-3 rounded-xl bg-brand-50 p-3"><p className="mb-1 text-sm font-semibold">{t('Code d’invitation au foyer pour l’inscription (visible uniquement maintenant)')}</p><output className="block break-all font-mono text-sm text-brand-700">{code}</output></div>}
        </div>
      </div> : <div className="card p-5 sm:p-6"><p className="muted">{t('Seuls les admins du foyer peuvent le renommer, inviter des personnes ou rejoindre une famille.')}</p></div>}
    </div>
  </section>
}
