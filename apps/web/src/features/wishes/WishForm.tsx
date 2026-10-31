import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { api, ApiError, HandledError, json, money, nameOf, type DuplicateWishError, type Person, type Wish } from '../../api'
import { wishPath } from '../../routes'
import { useTranslation } from '../../language-context'
import { localizeMessage } from '../../locale'
import { Icon } from '../../components/atoms/Icon'
import { TextArea } from '../../components/atoms/TextArea'
import { TextInput } from '../../components/atoms/TextInput'
import { FormField } from '../../components/molecules/FormField'

type WishDraft = { url: string; title: string; image: string; description?: string; price?: number; tags: string[] }

export function WishForm({ owner, busy, perform, handleError, onClose }: { owner?: Person | null; busy: boolean; perform: (action: () => Promise<unknown>, success: string) => Promise<boolean>; handleError: (error: unknown) => void; onClose: () => void }) {
  const { locale, t } = useTranslation()
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [preview, setPreview] = useState<Partial<Wish> | null>(null)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [duplicate, setDuplicate] = useState<{ draft: WishDraft; existing: Wish[] } | null>(null)
  const reportError = useRef(handleError)
  useEffect(() => { reportError.current = handleError })
  const save = (draft: WishDraft, allowDuplicate: boolean) => perform(async () => {
    try {
      await api(owner ? `/users/${owner.id}/wishes` : '/wishes', json('POST', { ...draft, allowDuplicate }))
    } catch (problem) {
      const body = problem instanceof ApiError && problem.status === 409 ? problem.body as Partial<DuplicateWishError> | undefined : undefined
      if (!body?.duplicates?.length) throw problem
      setDuplicate({ draft, existing: body.duplicates })
      throw new HandledError(problem instanceof Error ? problem.message : '')
    }
  }, owner ? t('Envie ajoutée à la liste de {name}.', { name: nameOf(owner) }) : t('Envie ajoutée à votre liste.'))
  // Pasting a link should be enough, like in a messaging app: we look the page up on our own,
  // after a short pause so an address typed by hand is not queried at every keystroke.
  useEffect(() => {
    const candidate = url.trim()
    if (!/^https?:\/\/[^\s/]+\.[^\s/]{2,}/i.test(candidate)) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setLoading(true)
      void (async () => {
        try {
          const found = await api<Partial<Wish> & { notice?: string }>('/wishes/preview', { ...json('POST', { url: candidate }), signal: controller.signal })
          if (controller.signal.aborted) return
          setNotice(found.notice || '')
          setPreview(found)
        } catch (problem) {
          if (controller.signal.aborted) return
          if (problem instanceof ApiError && problem.status === 400) setNotice(problem.message)
          else reportError.current(problem)
        } finally { if (!controller.signal.aborted) setLoading(false) }
      })()
    }, 600)
    return () => { clearTimeout(timer); controller.abort() }
  }, [url])
  return <form onChange={() => setDuplicate(null)} onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); void save({ url, title: String(data.get('title') || ''), image: String(data.get('image') || ''), description: String(data.get('description') || '') || undefined, price: data.get('price') ? Number(data.get('price')) : undefined, tags: String(data.get('tags') || '').split(',').map(tag => tag.trim()).filter(Boolean) }, false) }}>
    <FormField id="product-url" label={t('Lien du produit')} hint={loading ? t('Lecture du lien…') : t('Collez un lien : les informations se remplissent toutes seules.')}><TextInput id="product-url" type="url" placeholder="https://example.com/product" value={url} onChange={event => { setUrl(event.target.value); setPreview(null); setNotice(''); setLoading(false) }} required/></FormField>
    {notice && <p role="status" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><span className="font-semibold">{localizeMessage(notice, locale)}.</span> {preview ? t('Nous avons repris le nom depuis le lien : vérifiez-le et complétez si besoin.') : t('Vous pouvez remplir les champs à la main : seul le nom est nécessaire.')}</p>}
    {preview && <div className="mt-4 flex items-center gap-3 rounded-xl bg-brand-50 p-3">{preview.image && <img src={preview.image} alt="" className="size-14 shrink-0 rounded-lg object-cover"/>}<span className="min-w-0 text-sm font-semibold [overflow-wrap:anywhere]">{preview.title || t('Produit trouvé')}</span></div>}
    <div className="mt-5 space-y-4" key={preview?.url || preview?.title || 'empty'}>
      <FormField id="product-title" label={t('Nom de l’envie')}><TextInput id="product-title" name="title" defaultValue={preview?.title || ''} required/></FormField>
      <FormField id="product-image" label={t('URL de l’image')} optional><TextInput id="product-image" name="image" type="url" defaultValue={preview?.image || ''} placeholder="https://…"/></FormField>
      <FormField id="product-description" label={t('Description')} optional><TextArea className="min-h-20" id="product-description" name="description" defaultValue={preview?.description || ''}/></FormField>
      <div className="grid gap-3 lg:grid-cols-2">
        <FormField id="product-price" label={t('Prix (€)')}><TextInput id="product-price" name="price" type="number" min="0" step="0.01" defaultValue={preview?.price ?? ''}/></FormField>
        <FormField id="product-tags" label={t('Tags')}><TextInput id="product-tags" name="tags" defaultValue={preview?.tags?.join(', ') || ''} placeholder={t('livre, déco')}/></FormField>
      </div>
    </div>{duplicate ? <DuplicateWarning duplicate={duplicate} owner={owner} busy={busy}
      onCancel={onClose}
      onView={wish => { onClose(); navigate(wishPath(String(wish.id))) }}
      onConfirm={() => void save(duplicate.draft, true)}/>
      : <button disabled={busy} className="primary mt-6 w-full"><Icon name="plus" size={17}/> {owner ? t('Ajouter à sa liste') : t('Ajouter à ma liste')}</button>}
  </form>
}

const hostOf = (link?: string | null) => {
  try { return link ? new URL(link).hostname.replace(/^www\./, '') : '' } catch { return '' }
}

function DuplicateWarning({ duplicate, owner, busy, onCancel, onView, onConfirm }: { duplicate: { draft: WishDraft; existing: Wish[] }; owner?: Person | null; busy: boolean; onCancel: () => void; onView: (wish: Wish) => void; onConfirm: () => void }) {
  const { t } = useTranslation()
  const summary = (wish: { title: string; url?: string | null; price?: number | string }) => <>
    <p className="font-semibold [overflow-wrap:anywhere]">{wish.title}</p>
    {hostOf(wish.url) && <p className="muted text-xs [overflow-wrap:anywhere]">{hostOf(wish.url)}</p>}
    {wish.price != null && wish.price !== '' && <p className="muted text-xs">{money(wish.price)}</p>}
  </>
  return <div role="alert" className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
    <p className="font-semibold">{owner ? t('Cette envie ressemble à une envie déjà présente sur la liste de {name}.', { name: nameOf(owner) }) : t('Cette envie ressemble à une envie déjà présente sur votre liste.')}</p>
    <p className="mt-1">{t('Comparez-les avant de continuer : ajoutez-la quand même seulement s’il s’agit d’une autre envie.')}</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg bg-white p-3"><p className="eyebrow mb-1">{t('Déjà dans la liste')}</p>
        <ul className="space-y-3">{duplicate.existing.map(wish => <li key={wish.id}>{summary(wish)}
          <button type="button" className="secondary mt-2 text-xs" onClick={() => onView(wish)}>{t('Voir l’envie existante')} <Icon name="arrow" size={13}/></button></li>)}</ul>
      </div>
      <div className="rounded-lg bg-white p-3"><p className="eyebrow mb-1">{t('Nouvelle envie')}</p>{summary(duplicate.draft)}</div>
    </div>
    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
      <button type="button" className="secondary flex-1" onClick={onCancel}>{t('Annuler l’ajout')}</button>
      <button type="button" disabled={busy} className="primary flex-1" onClick={onConfirm}><Icon name="plus" size={17}/> {t('Ajouter quand même')}</button>
    </div>
  </div>
}

// The title is immutable, with or without a reservation: it never appears as an input here,
// only as a read-only reminder, so nobody mistakes this for a way to rename the wish.
export function WishEditForm({ wish, busy, perform }: { wish: Wish; busy: boolean; perform: (action: () => Promise<unknown>, success: string) => Promise<boolean> }) {
  const { t } = useTranslation()
  return <form onSubmit={event => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const price = String(data.get('price') || '').trim()
    const description = String(data.get('description') || '').trim()
    void perform(() => api(`/wishes/${wish.id}`, json('PATCH', {
      url: String(data.get('url') || '').trim(),
      image: String(data.get('image') || '').trim(),
      description: description || null,
      price: price ? Number(price) : null,
      tags: String(data.get('tags') || '').split(',').map(tag => tag.trim()).filter(Boolean),
    })), t('Envie mise à jour.'))
  }}>
    <div className="mb-5 rounded-xl bg-surface-soft px-3 py-2.5">
      <p className="text-sm font-semibold">{wish.title}</p>
      <p className="muted mt-0.5 text-xs">{t('Le nom ne peut plus être modifié après la création.')}</p>
    </div>
    <div className="space-y-4">
      <FormField id="edit-url" label={t('Lien du produit')} optional><TextInput id="edit-url" name="url" type="url" defaultValue={wish.url || ''} placeholder="https://…"/></FormField>
      <FormField id="edit-image" label={t('URL de l’image')} optional><TextInput id="edit-image" name="image" type="url" defaultValue={wish.image || ''} placeholder="https://…"/></FormField>
      <FormField id="edit-description" label={t('Description')} optional><TextArea className="min-h-20" id="edit-description" name="description" defaultValue={wish.description || ''}/></FormField>
      <div className="grid gap-3 lg:grid-cols-2">
        <FormField id="edit-price" label={t('Prix (€)')} optional><TextInput id="edit-price" name="price" type="number" min="0" step="0.01" defaultValue={wish.price ?? ''}/></FormField>
        <FormField id="edit-tags" label={t('Tags')} optional><TextInput id="edit-tags" name="tags" defaultValue={wish.tags?.join(', ') || ''} placeholder={t('livre, déco')}/></FormField>
      </div>
    </div>
    <button disabled={busy} className="primary mt-6 w-full"><Icon name="edit" size={17}/> {t('Enregistrer les modifications')}</button>
  </form>
}
