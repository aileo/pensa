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
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState('')
  const onAuth = (person: Person) => { setAccount({ person, session: ++session.current }); setError('') }

  useEffect(() => {
    let active = true
    api<Person>('/auth/me').then(person => { if (active) onAuth(person) }).catch(problem => {
      if (active && !(problem instanceof ApiError && problem.status === 401)) setError(problem instanceof Error ? problem.message : t('Une erreur inattendue est survenue.'))
    }).finally(() => { if (active) setAuthChecked(true) })
    return () => { active = false }
  }, [t])

  if (!authChecked) return <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-brand-600"><LanguageControl/><p role="status">{t('Chargement de Pensa…')}</p></div>
  if (!account) return <Auth mode={authMode} setMode={setAuthMode} onAuth={onAuth} error={error} setError={setError} />
  return <AuthenticatedApp key={account.session} me={account.person} onLogout={() => setAccount(null)} onProfile={person => setAccount(current => current && { ...current, person })} />
}

export default App
