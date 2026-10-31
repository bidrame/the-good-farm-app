# The Good Farm — application de gestion

Application web installable (Android) pour saisir les ventes, les dépenses, la ponte et les crédits clients de la ferme, avec des données partagées entre deux comptes.

La spécification et le plan de construction ne sont pas dans ce dépôt public : ils contiennent des chiffres de la ferme. Ils sont gardés dans le dossier Google Drive « The Good Farm ».

## Installer l'appli sur un téléphone

1. Ouvrir l'adresse de l'appli dans **Chrome** sur le téléphone.
2. Menu ⋮ → **Ajouter à l'écran d'accueil** (ou « Installer l'application »).
3. Ouvrir l'icône **Good Farm** et se connecter avec son e-mail et son mot de passe.

## Sauvegarde chaque semaine

Plus → **Export Excel** → **Exporter et partager** → choisir **Drive** et le dossier « The Good Farm ».
L'accueil affiche un rappel si la dernière sauvegarde date de plus de 7 jours.

## Si l'appli n'affiche plus les données

L'offre gratuite de Supabase met le projet en pause après 7 jours sans aucune utilisation (les données ne sont pas perdues).
Se connecter sur supabase.com → projet **the-good-farm** → **Restore project**.
Les saisies faites pendant ce temps restent sur le téléphone et partent dès que la base répond.

## Pour le développement

```bash
npm install
npm test          # tous les tests (calculs, écrans, SQL, import)
npm run dev       # appli locale sur http://localhost:5173
npm run demo      # appli locale avec des données d'exemple, sans Supabase
```

Fichier `.env.local` (jamais commité) : voir `.env.example`.

### Mise en service (une fois)

1. **Supabase** : créer le projet `the-good-farm`, désactiver les inscriptions (Authentication → Sign In / Providers → décocher « Allow new users to sign up »), créer les deux comptes, appliquer `supabase/migrations/*.sql` dans l'ordre, puis ajouter chaque compte dans la table `profils` (id du compte + prénom).
2. **Reprise de l'historique** :
   ```bash
   npx tsx scripts/import/proposerFusions.ts chemin/vers/classeur.xlsx   # crée import/fusions.csv
   # faire valider import/fusions.csv : chaque ligne a_verifier devient fusionner ou ignorer
   npx tsx scripts/import/importer.ts chemin/vers/classeur.xlsx import/fusions.csv
   npx tsx scripts/import/verifierTotaux.ts
   ```
3. **GitHub** : dépôt public `the-good-farm-app`, Settings → Pages → Source « GitHub Actions » ; variables (Settings → Secrets and variables → Actions → Variables) `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (publiques par nature) ; variable `DOMAINE` (ex. `ferme.thegoodfarm.sn`).
4. **Nom de domaine** : chez le registrar, enregistrement `CNAME` de `ferme` vers `<compte-github>.github.io` ; puis Pages → Enforce HTTPS.

Le dépôt est public : il ne contient que le code. Les données de la ferme sont uniquement dans Supabase, protégées par les comptes (Row Level Security).
