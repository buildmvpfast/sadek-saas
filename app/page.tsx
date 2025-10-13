import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white">
            MT5 Copy Trading SaaS
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Copiez automatiquement les trades de votre admin MT5
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card">
            <h2 className="text-2xl font-bold mb-4">Fonctionnalités</h2>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li>✓ Connexion MT5 multi-broker</li>
              <li>✓ Copy trading automatique</li>
              <li>✓ Gestion par lot ou pourcentage</li>
              <li>✓ Dashboard en temps réel</li>
              <li>✓ Abonnement sécurisé</li>
            </ul>
          </div>
          
          <div className="card">
            <h2 className="text-2xl font-bold mb-4">Commencer</h2>
            <div className="space-y-4">
              <Link href="/auth/signup" className="btn btn-primary w-full block text-center">
                S'inscrire
              </Link>
              <Link href="/auth/login" className="btn btn-secondary w-full block text-center">
                Se connecter
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

