# Fix Render : `could not read Username for 'https://github.com'`

Render ne peut pas cloner un repo **privé** sans accès GitHub OAuth.

## Solution (2 min)

1. [dashboard.render.com](https://dashboard.render.com) → **Account Settings** → **Git Providers**
2. **Connect GitHub** (ou **Reconnect** si déjà connecté)
3. Autoriser l’orga/repo `sadeksaasallfeed`
4. Service → **Settings** → **Build & Deploy** → **Disconnect** puis reconnecter le repo via **Connect GitHub** (pas URL HTTPS manuelle)
5. **Manual Deploy** → Deploy latest commit

## Si tu as collé une URL HTTPS manuellement

Ne pas utiliser `https://github.com/user/repo.git` — Render ne peut pas demander user/password en CI.

Utiliser uniquement : **New → Web Service → Connect GitHub → choisir le repo**.

## Repo public (alternative)

Settings GitHub → repo → **Change visibility → Public** — le clone HTTPS fonctionne sans auth.

## Vérifier après fix

Logs build doivent afficher `Cloning from https://github.com/...` puis `Checkout succeeded` — pas de retry fatal.
