import { Component, useState, type ReactNode } from 'react'
import { formatDate, formatFCFA } from './lib/format'
import { Confirmation } from './ui/composants/communs'
import { HashRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { useSession } from './data/auth'
import { DonneesProvider, useDonnees } from './data/useDonnees'
import { BarreNav } from './ui/composants/BarreNav'
import { Retour } from './ui/composants/Retour'
import { remettreEnBrouillon } from './ui/corriger'
import { Accueil } from './ui/pages/Accueil'
import { Alertes } from './ui/pages/Alertes'
import { Aliment } from './ui/pages/Aliment'
import { BandeFiche } from './ui/pages/BandeFiche'
import { Bandes } from './ui/pages/Bandes'
import { ClientFiche } from './ui/pages/ClientFiche'
import { Clients } from './ui/pages/Clients'
import { Connexion } from './ui/pages/Connexion'
import { Corbeille } from './ui/pages/Corbeille'
import { Couts } from './ui/pages/Couts'
import { Export } from './ui/pages/Export'
import { FournisseurFiche } from './ui/pages/FournisseurFiche'
import { Fournisseurs } from './ui/pages/Fournisseurs'
import { Historique } from './ui/pages/Historique'
import { Plus } from './ui/pages/Plus'
import { Ponte } from './ui/pages/Ponte'
import { Ramassage } from './ui/pages/Ramassage'
import { Rapports } from './ui/pages/Rapports'
import { Reglages } from './ui/pages/Reglages'
import { Saisir } from './ui/pages/Saisir'
import { Stock } from './ui/pages/Stock'
import './ui/theme.css'

/** Traduit une erreur du serveur en une phrase compréhensible. */
function expliquer(erreur: string): string {
  if (/duplicate key|unique/i.test(erreur)) return 'Il existe déjà une saisie identique (même jour, même box ou même nom).'
  if (/foreign key/i.test(erreur)) return 'Elle dépend d’une autre saisie qui n’existe pas ou plus.'
  if (/check constraint|violates/i.test(erreur)) return 'Une valeur a été refusée (nombre négatif, montant payé trop grand…).'
  if (/permission|row-level security/i.test(erreur)) return 'Accès refusé : reconnectez-vous.'
  return 'Le serveur l’a refusée.'
}

/** Dit de quelle saisie il s'agit (genre, jour, montant ou œufs), pour la retrouver dans ses notes. */
function resumer(table: string, ligne: Record<string, unknown>): string {
  const date = typeof ligne.date === 'string' ? ` du ${formatDate(ligne.date)}` : ''
  const montant = typeof ligne.montant === 'number' ? ` · ${formatFCFA(ligne.montant)}` : ''
  if (table === 'transactions') return `${ligne.type === 'depense' ? 'Dépense' : 'Vente'}${date}${montant}`
  if (table === 'ponte') return `Ponte${date}${typeof ligne.oeufs_collectes === 'number' ? ` · ${ligne.oeufs_collectes} œufs` : ''}`
  const nom = NOM_TABLE[table] ?? table
  return `${nom[0].toUpperCase()}${nom.slice(1)}${date}${montant}${typeof ligne.nom === 'string' ? ` · ${ligne.nom}` : ''}`
}

const NOM_TABLE: Record<string, string> = {
  transactions: 'vente ou dépense', paiements: 'paiement', ponte: 'ponte', bandes: 'bande', clients: 'client',
  produits: 'produit', ouvriers: 'ouvrier', reglages: 'réglages', profils: 'profil', recensements: 'recomptage', mortalites: 'mortalité', ramassages: 'livraison',
}

function BandeauEtat() {
  const { erreur, enAttente, rejetees, rafraichir, reessayer, abandonner } = useDonnees()
  const [aAbandonner, setAAbandonner] = useState<string | null>(null)
  const naviguer = useNavigate()
  return (
    <>
      {(erreur || enAttente > 0) && (
        <div className="alerte attention ligne bandeau-fixe" role="status" style={{ margin: 0, borderRadius: 0 }}>
          <span>
            {erreur ?? ''}{' '}
            {enAttente > 0 && `${enAttente} saisie${enAttente > 1 ? 's' : ''} gardée${enAttente > 1 ? 's' : ''} sur le téléphone, envoi dès le retour du réseau`}
          </span>
          {erreur && <button onClick={() => rafraichir()}>Réessayer</button>}
        </div>
      )}
      {rejetees.length > 0 && (
        <section aria-label="Saisies refusées" className="alerte danger" style={{ margin: 0, borderRadius: 0, display: 'block' }}>
          <strong>Saisies refusées par le serveur</strong>
          <div style={{ fontWeight: 400 }}>« Corriger » rouvre la saisie dans son formulaire. Sinon, notez-la avant de l’abandonner.</div>
          {rejetees.map((r) => {
            const ligne = (r.op.ligne ?? {}) as Record<string, unknown>
            const corrigeable = r.op.action === 'upsert' && (r.op.table === 'transactions' || r.op.table === 'ponte')
            return (
              <div key={r.op.id} style={{ marginTop: 8 }}>
                <div>{resumer(r.op.table, ligne)} : {expliquer(r.erreur)}</div>
                {corrigeable && (
                  <button className="principal" style={{ marginTop: 4 }} onClick={async () => {
                    const vers = remettreEnBrouillon(r.op.table, ligne)
                    if (!vers) return
                    await abandonner(r.op.id)
                    naviguer(vers)
                  }}>Corriger</button>
                )}
                <div className="grille2" style={{ marginTop: 4 }}>
                  <button onClick={() => reessayer(r.op.id)}>Réessayer</button>
                  <button onClick={() => setAAbandonner(r.op.id)}>Abandonner</button>
                </div>
              </div>
            )
          })}
        </section>
      )}
      {aAbandonner && (
        <Confirmation
          message="Abandonner cette saisie ? Elle sera effacée du téléphone et ne pourra pas être récupérée."
          oui="Oui, abandonner"
          non="Garder"
          onOui={() => { abandonner(aAbandonner); setAAbandonner(null) }}
          onNon={() => setAAbandonner(null)}
        />
      )}
    </>
  )
}

/** Une erreur d'affichage ne doit pas laisser l'écran blanc. */
class FiletDeSecurite extends Component<{ children: ReactNode }, { erreur: boolean }> {
  state = { erreur: false }
  static getDerivedStateFromError() {
    return { erreur: true }
  }
  render() {
    if (!this.state.erreur) return this.props.children
    return (
      <main>
        <p>Un problème d’affichage est survenu. Vos saisies sont conservées.</p>
        <button className="principal" onClick={() => { this.setState({ erreur: false }); location.hash = '#/' }}>Revenir à l’accueil</button>
      </main>
    )
  }
}

export function Pages() {
  return (
    <>
      <BandeauEtat />
      <Retour />
      <FiletDeSecurite>
      <Routes>
        <Route path="/" element={<Accueil />} />
        <Route path="/saisir" element={<Saisir />} />
        <Route path="/ponte" element={<Ponte />} />
        <Route path="/bandes" element={<Bandes />} />
        <Route path="/bandes/:id" element={<BandeFiche />} />
        <Route path="/aliment" element={<Aliment />} />
        <Route path="/couts" element={<Couts />} />
        <Route path="/alertes" element={<Alertes />} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/livraison" element={<Ramassage />} />
        <Route path="/ramassage" element={<Ramassage />} />
        <Route path="/plus" element={<Plus />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/clients/:id" element={<ClientFiche />} />
        <Route path="/fournisseurs" element={<Fournisseurs />} />
        <Route path="/fournisseurs/:id" element={<FournisseurFiche />} />
        <Route path="/rapports" element={<Rapports />} />
        <Route path="/historique" element={<Historique />} />
        <Route path="/corbeille" element={<Corbeille />} />
        <Route path="/export" element={<Export />} />
        <Route path="/reglages" element={<Reglages />} />
        <Route path="*" element={<Accueil />} />
      </Routes>
      </FiletDeSecurite>
      <BarreNav />
    </>
  )
}

/** `sansDonnees` : les tests fournissent eux-mêmes les données (DonneesFixes). */
export function Coquille({ session, sansDonnees = false }: { session: unknown | null; sansDonnees?: boolean }) {
  if (!session) return <Connexion />
  return <HashRouter>{sansDonnees ? <Pages /> : <DonneesProvider><Pages /></DonneesProvider>}</HashRouter>
}

export default function App() {
  const { session, pret } = useSession()
  if (!pret) return null
  return <Coquille session={session} />
}
