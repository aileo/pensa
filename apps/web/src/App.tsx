import { useEffect, useRef, useState } from 'react'
import { api, ApiError, type Person } from './api'
import { Auth } from './features/auth/Auth'
import { AuthenticatedApp } from './AppShell'
import { LanguageControl } from './language'
import { useTranslation } from './language-context'
import './index.css'

function App() {
  const { t } = useTranslation()
  const [account, setAccount] = useState<{ person: Person; session: number } | null>(null)
  const session = useRef(0)
  const [authChecked, setAuthChecked] = useState(false)
  const [authAttempt, setAuthAttempt] = useState(0)
  const [sessionError, setSessionError] = useState('')
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState('')
  const onAuth = (person: Person) => { setAccount({ person, session: ++session.current }); setError(''); setSessionError('') }
  const retrySession = () => { setAuthChecked(false); setSessionError(''); setAuthAttempt(value => value + 1) }

  useEffect(() => {
    let active = true
    api<Person>('/auth/me').then(person => {
      if (active) {
        setSessionError('')
        setAccount(current => current && String(current.person.id) === String(person.id) ? current : { person, session: ++session.current })
      }
    }).catch(problem => {
      if (!active) return
      if (problem instanceof ApiError && problem.status === 401) { setAccount(null); setSessionError('') }
      else setSessionError(problem instanceof Error ? problem.message : t('Une erreur inattendue est survenue.'))
    }).finally(() => { if (active) setAuthChecked(true) })
    return () => { active = false }
  }, [t, authAttempt])

  if (!account && !authChecked) return <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-brand-600"><LanguageControl/><p role="status">{t('Chargement de Pensa…')}</p></div>
  if (!account && sessionError) return <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6"><LanguageControl/><h1>{t('Vérification de la session impossible')}</h1><p role="alert">{sessionError}</p><button className="primary" onClick={retrySession}>{t('Réessayer')}</button></div>
  if (!account) return <Auth mode={authMode} setMode={setAuthMode} onAuth={onAuth} error={error} setError={setError} />
  return <>
    {sessionError && <div role="alert" className="border-b border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{t('Vérification de la session impossible')}: {sessionError}</p><button className="secondary mt-2" onClick={retrySession}>{t('Réessayer')}</button></div>}
    <AuthenticatedApp key={account.session} me={account.person} onLogout={() => { setAccount(null); setSessionError('') }} onProfile={person => setAccount(current => current && { ...current, person })} />
  </>
}

export default App
