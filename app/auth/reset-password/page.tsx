'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [recoveryReady, setRecoveryReady] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const applyRecoverySession = useCallback(async () => {
    setError('')

    // Flux PKCE (Supabase récent) : ?code=...
    const code = searchParams.get('code')
    if (code) {
      const { error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code)
      if (exchangeError) {
        setError(exchangeError.message)
        return
      }
      setRecoveryReady(true)
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', window.location.pathname)
      }
      return
    }

    // Flux classique : tokens dans le hash (#access_token=...&refresh_token=...&type=recovery)
    // useSearchParams() ne lit pas le hash → on parse window.location.hash
    const hash =
      typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : ''
    const hashParams = new URLSearchParams(hash)
    const accessToken =
      hashParams.get('access_token') || searchParams.get('access_token')
    const refreshToken =
      hashParams.get('refresh_token') || searchParams.get('refresh_token')

    if (accessToken && refreshToken) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      if (sessionError) {
        setError(sessionError.message)
        return
      }
      setRecoveryReady(true)
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', window.location.pathname)
      }
      return
    }

    // Déjà une session (ex. rechargement après setSession)
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session) {
      setRecoveryReady(true)
      return
    }

    setError(
      'Lien invalide ou expiré. Redemandez un e-mail depuis la page de connexion (Mot de passe oublié).',
    )
  }, [searchParams, supabase])

  useEffect(() => {
    applyRecoverySession()
  }, [applyRecoverySession])

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!recoveryReady) {
      setError(
        'Lien de réinitialisation invalide ou expiré. Demandez un nouveau mail depuis la connexion.',
      )
      return
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) throw error

      setSuccess(true)
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="page-container pattern-bg">
        <div className="card max-w-md w-full">
          <div className="text-center">
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-2xl font-bold mb-4" style={{ color: '#9b30a8' }}>
              Mot de passe mis à jour!
            </h1>
            <p className="text-gray-600 mb-4">
              Votre mot de passe a été modifié avec succès.
            </p>
            <p className="text-sm text-gray-500">
              Redirection vers le dashboard...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container pattern-bg">
      <div className="card max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black mb-2" style={{ color: '#9b30a8' }}>
            L'IMPRIMANTE®
          </h1>
          <div className="h-1 w-32 bg-gray-300 mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-gray-900">Nouveau mot de passe</h2>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {!recoveryReady && !error && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded mb-4 text-sm">
            Vérification du lien… Si rien ne change, ouvrez cette page depuis le
            bouton du mail (pas une copie d’URL tronquée).
          </div>
        )}

        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Nouveau mot de passe *</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="Votre nouveau mot de passe"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Confirmer le mot de passe *</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input"
              placeholder="Confirmez votre nouveau mot de passe"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !recoveryReady}
            className="btn btn-primary w-full"
          >
            {loading ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <Link href="/auth/login" className="text-sm text-primary-700 hover:text-primary-800 underline">
            ← Retour à la connexion
          </Link>
        </div>
      </div>
    </div>
  )
}
