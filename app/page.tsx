import Link from 'next/link'

const features = [
  {
    icon: '📡',
    title: 'Signaux Telegram en temps réel',
    description:
      'Connectez vos canaux favoris. Chaque signal est parsé automatiquement (entrée, SL, TP multiples, annulations).',
  },
  {
    icon: '⚡',
    title: 'Exécution automatique MT5',
    description:
      'Vos ordres partent sur votre compte MetaTrader en quelques secondes — MARKET, LIMIT ou STOP selon le signal.',
  },
  {
    icon: '🏦',
    title: 'Multi-brokers',
    description:
      'Vantage, VT Markets, Raise FX et plus. Résolution automatique des symboles broker (GOLD, BTC, indices…).',
  },
  {
    icon: '🎯',
    title: 'Gestion du risque',
    description:
      'Lots par instrument, multiplicateur, pause trading, pertes max journalières — tout est configurable depuis votre dashboard.',
  },
  {
    icon: '📊',
    title: 'Multi take profits',
    description:
      'Un signal avec plusieurs TP ouvre plusieurs positions, avec répartition intelligente du volume.',
  },
  {
    icon: '🛡️',
    title: 'Contrôle total',
    description:
      'Breakeven, modification SL/TP, fermeture partielle ou annulation — le bot suit les instructions du canal.',
  },
]

const steps = [
  {
    step: '01',
    title: 'Créez votre compte',
    description: 'Inscription en 30 secondes. Choisissez votre abonnement et accédez au dashboard.',
  },
  {
    step: '02',
    title: 'Connectez votre MT5',
    description: 'Liez votre compte broker via MetaAPI. Sélectionnez votre profil symbole (ECN, STP, auto).',
  },
  {
    step: '03',
    title: 'Configurez vos lots',
    description: 'Définissez vos tailles de position par instrument et vos limites de risque.',
  },
  {
    step: '04',
    title: 'Abonnez-vous aux canaux',
    description: 'Activez les canaux Telegram. Les signaux sont copiés automatiquement sur votre compte.',
  },
]

export default function Home() {
  return (
    <div className="min-h-screen pattern-bg">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/10 border-b border-white/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <Link
              href="/"
              className="text-xl sm:text-2xl font-black text-white tracking-tight"
            >
              L&apos;IMPRIMANTE®
            </Link>

            <nav className="hidden md:flex items-center gap-8">
              <a
                href="#features"
                className="text-white/90 hover:text-white font-semibold text-sm transition-colors"
              >
                Fonctionnalités
              </a>
              <a
                href="#how-it-works"
                className="text-white/90 hover:text-white font-semibold text-sm transition-colors"
              >
                Comment ça marche
              </a>
            </nav>

            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/auth/login"
                className="px-4 py-2 text-sm sm:text-base font-bold text-white hover:text-white/80 transition-colors"
              >
                Connexion
              </Link>
              <Link
                href="/auth/signup"
                className="px-4 sm:px-6 py-2 sm:py-2.5 text-sm sm:text-base font-bold rounded-full bg-white transition-all hover:scale-105 shadow-lg"
                style={{ color: '#9b30a8' }}
              >
                S&apos;inscrire
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-20">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 border border-white/25 text-white text-sm font-semibold mb-8">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Copy trading automatisé pour traders francophones
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight tracking-tight max-w-4xl mx-auto">
            Copiez les signaux Telegram directement sur votre{' '}
            <span className="text-white/90 underline decoration-white/40 underline-offset-4">
              compte MT5
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-white/85 max-w-2xl mx-auto leading-relaxed">
            La plateforme qui transforme les signaux de vos canaux en ordres exécutés
            sur votre broker — avec gestion du risque, multi-TP et contrôle total.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/signup"
              className="btn btn-primary w-full sm:w-auto px-10 flex items-center justify-center gap-2"
            >
              Commencer gratuitement
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              href="/auth/login"
              className="btn btn-secondary w-full sm:w-auto px-10"
            >
              J&apos;ai déjà un compte
            </Link>
          </div>

          <p className="mt-6 text-sm text-white/60">
            Pas de carte bancaire pour démarrer · Configuration en moins de 5 min
          </p>
        </div>

        {/* Hero visual */}
        <div className="max-w-4xl mx-auto mt-16">
          <div className="card-white p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-primary-100">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-400" />
                <span className="w-3 h-3 rounded-full bg-yellow-400" />
                <span className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <span className="text-sm font-semibold" style={{ color: '#9b30a8' }}>
                Dashboard — L&apos;IMPRIMANTE
              </span>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { label: 'Signaux reçus', value: '24', sub: 'aujourd\'hui' },
                { label: 'Positions ouvertes', value: '6', sub: '3 brokers' },
                { label: 'Taux d\'exécution', value: '98%', sub: 'ce mois' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl p-4 border-2"
                  style={{ borderColor: '#e5d0e8', backgroundColor: '#fdf4ff' }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-70" style={{ color: '#9b30a8' }}>
                    {stat.label}
                  </p>
                  <p className="text-3xl font-black mt-1" style={{ color: '#9b30a8' }}>
                    {stat.value}
                  </p>
                  <p className="text-xs mt-1 opacity-60" style={{ color: '#9b30a8' }}>
                    {stat.sub}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl p-4 text-sm font-mono" style={{ backgroundColor: '#f5e8f7', color: '#701a75' }}>
              <span className="opacity-60">signal →</span> BUY GOLD 2654 · SL 2650 · TP 2660, 2665
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                exécuté
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-4 sm:px-6 lg:px-8 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Tout ce qu&apos;il faut pour copier en automatique
            </h2>
            <p className="mt-4 text-lg text-white/80 max-w-2xl mx-auto">
              Une stack complète entre Telegram et MetaTrader — sans intervention manuelle.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="card-white hover:shadow-2xl transition-shadow">
                <span className="text-3xl">{f.icon}</span>
                <h3 className="text-xl font-black mt-4" style={{ color: '#9b30a8' }}>
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed opacity-80" style={{ color: '#701a75' }}>
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="px-4 sm:px-6 lg:px-8 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Opérationnel en 4 étapes
            </h2>
            <p className="mt-4 text-lg text-white/80">
              De l&apos;inscription à la première position copiée.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s) => (
              <div
                key={s.step}
                className="relative rounded-3xl p-6 border-2 border-white/20 bg-white/10 backdrop-blur-sm"
              >
                <span className="text-4xl font-black text-white/30">{s.step}</span>
                <h3 className="text-lg font-black text-white mt-2">{s.title}</h3>
                <p className="mt-2 text-sm text-white/75 leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 sm:px-6 lg:px-8 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="card text-center">
            <h2 className="text-3xl sm:text-4xl font-black" style={{ color: '#9b30a8' }}>
              Prêt à laisser tourner l&apos;imprimante ?
            </h2>
            <p className="mt-4 text-lg opacity-80 max-w-xl mx-auto" style={{ color: '#701a75' }}>
              Rejoignez la communauté de trading francophone N°1. Configurez votre compte,
              connectez votre MT5 et laissez les signaux travailler pour vous.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth/signup" className="btn btn-primary w-full sm:w-auto px-10">
                Créer mon compte
              </Link>
              <Link href="/auth/login" className="btn btn-secondary w-full sm:w-auto px-10">
                Se connecter
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 sm:px-6 lg:px-8 py-10 border-t border-white/20">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-center sm:text-left">
            <p className="text-xl font-black text-white">L&apos;IMPRIMANTE®</p>
            <p className="text-sm text-white/60 mt-1">
              Copy trading Telegram → MT5
            </p>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://www.youtube.com/@SadekTV"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/70 hover:text-white transition-colors"
              aria-label="YouTube Sadek TV"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </a>
            <a
              href="https://www.instagram.com/sadek93zoo"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/70 hover:text-white transition-colors"
              aria-label="Instagram Sadek93zoo"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </a>
          </div>

          <p className="text-xs text-white/50">
            © {new Date().getFullYear()} L&apos;IMPRIMANTE®. Tous droits réservés.
          </p>
        </div>
      </footer>

      {/* Decorative */}
      <div className="fixed top-20 left-10 w-40 h-40 bg-white opacity-5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-20 right-10 w-56 h-56 bg-white opacity-5 rounded-full blur-3xl pointer-events-none" />
    </div>
  )
}
