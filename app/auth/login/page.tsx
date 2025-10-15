'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      // Check if user is admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', data.user.id)
        .single()

      if (profile?.is_admin) {
        router.push('/admin/dashboard')
      } else {
        router.push('/dashboard')
      }
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Veuillez entrer votre email d\'abord')
      return
    }

    setError('')
    setLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (error) throw error

      setError('')
      alert('Email de réinitialisation envoyé! Vérifiez votre boîte mail.')
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'envoi de l\'email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container pattern-bg">
      <div className="card max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black mb-2" style={{ color: '#9b30a8' }}>L'IMPRIMANTE®</h1>
          <p className="text-xl font-bold" style={{ color: '#9b30a8' }}>Connexion</p>
        </div>
        
        {error && (
          <div className="bg-red-100 border-2 border-red-400 text-red-700 px-4 py-3 rounded-xl mb-4 font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: '#9b30a8' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: '#9b30a8' }}>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm font-semibold">
          Pas de compte?{' '}
          <Link href="/auth/signup" className="text-primary-700 hover:text-primary-800 underline">
            S'inscrire ici
          </Link>
        </p>

        <p className="mt-4 text-center text-sm">
          <button
            onClick={handleForgotPassword}
            className="text-primary-700 hover:text-primary-800 underline"
          >
            Mot de passe oublié?
          </button>
        </p>
        
        <div className="mt-4 text-center">
          <Link href="/" className="text-sm text-primary-700 hover:text-primary-800 underline">
            ← Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  )
}

