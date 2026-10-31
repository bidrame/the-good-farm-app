import { Component, type ReactNode } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { useSession } from './data/auth'
import { DonneesProvider, useDonnees } from './data/useDonnees'
import { BarreNav } from './ui/composants/BarreNav'
import { Accueil } from './ui/pages/Accueil'
import { BandeFiche } from './ui/pages/BandeFiche'
import { Bandes } from './ui/pages/Bandes'
import { ClientFiche } from './ui/pages/ClientFiche'
import { Clients } from './ui/pages/Clients'
import { Connexion } from './ui/pages/Connexion'
import { Corbeille } from './ui/pages/Corbeille'
import { Export } from './ui/pages/Export'
import { Historique } from './ui/pages/Historique'
import { Plus } from './ui/pages/Plus'
import { Ponte } from './ui/pages/Ponte'
import { Rapports } from './ui/pages/Rapports'
import { Reglages } from './ui/pages/Reglages'
import { Saisir } from './ui/pages/Saisir'
import './ui/theme.css'

/** Traduit une erreur du serveur en une phrase compréhensible. */
function expliquer(erreur: string): string {
  if (/duplicate key|unique/i.test(erreur)) return 'Il existe déjà une saisie identique (même jour, même box ou même nom).'
  if (/foreign key/i.test(erreur)) return 'Elle dépend d’une autre saisie qui n’existe pas ou plus.'
  if (/check constraint|violates/i.test(erreur)) return 'Une valeur a été refusée (nombre négatif, montant payé trop grand…).'
  if (/permission|row-level security/i.test(erreur)) return 'Accès refusé : reconnectez-vous.'
  return erreur
}

const NOM_TABLE: Record<string, string> = {
  transactions: 'vente ou dépense', paiements: 'paiement', ponte: 'ponte', bandes: 'bande', clients: 'client',
  produits: 'produit', ouvriers: 'ouvrier', reglages: 'réglages', profils: 'profil',
}

function BandeauEtat() {
  const { erreur, enAttente, rejetees, rafraichir, reessayer, abandonner } = useDonnees()
  return (
    <>
      {(erreur || enAttente > 0) && (
        <div className="alerte attention ligne" style={{ margin: 0, borderRadius: 0 }}>
          <span>{erreur ?? ''} {enAttente > 0 && `En attente d'envoi (${enAttente})`}</span>
          {erreur && <button onClick={() => rafraichir()}>Réessayer</button>}
        </div>
      )}
      {rejetees.length > 0 && (
        <section aria-label="Saisies refusées" className="alerte danger" style={{ margin: 0, borderRadius: 0 }}>
          <strong>Saisies refusées par le serveur</strong>
          {rejetees.map((r) => (
            <div key={r.op.id} style={{ marginTop: 6 }}>
              <div>{NOM_TABLE[r.op.table] ?? r.op.table} : {expliquer(r.erreur)}</div>
              <div className="grille2" style={{ marginTop: 4 }}>
                <button onClick={() => reessayer(r.op.id)}>Réessayer</button>
                <button onClick={() => abandonner(r.op.id)}>Abandonner</button>
              </div>
            </div>
          ))}
        </section>
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
      <FiletDeSecurite>
      <Routes>
        <Route path="/" element={<Accueil />} />
        <Route path="/saisir" element={<Saisir />} />
        <Route path="/ponte" element={<Ponte />} />
        <Route path="/bandes" element={<Bandes />} />
        <Route path="/bandes/:id" element={<BandeFiche />} />
        <Route path="/plus" element={<Plus />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/clients/:id" element={<ClientFiche />} />
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
