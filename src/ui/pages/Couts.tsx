import { useDonnees } from '../../data/useDonnees'
import { moyenneCouts, prixDeRevient, produitsExclus, type MoisCout } from '../../lib/calculs/couts'
import { aujourdhui, formatFCFA } from '../../lib/format'
import { EtatVide, Titre } from '../composants/Pastille'

const NOMS_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const nomMois = (m: string) => `${NOMS_MOIS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`
const MOIS_MOYENNE = 3

function Marge({ marge, prix }: { marge: number | null; prix: number | null }) {
  if (marge == null) return <span className="discret">—</span>
  const pct = prix ? Math.round((marge / prix) * 100) : null
  return <strong className={marge >= 0 ? 'entree' : 'sortie'}>{marge >= 0 ? '+' : ''}{formatFCFA(marge)}{pct != null ? ` (${pct} %)` : ''}</strong>
}

function LigneMois({ m }: { m: MoisCout }) {
  return (
    <details className="carte mois-cout">
      <summary>
        <span className="ligne" style={{ padding: 0 }}>
          <strong style={{ textTransform: 'capitalize' }}>{nomMois(m.mois)}</strong>
          <Marge marge={m.marge} prix={m.prixVente} />
        </span>
        <span className="discret" style={{ display: 'block' }}>
          {m.coutPlateau != null ? `coûte ${formatFCFA(m.coutPlateau)}` : 'pas de dépense'}
          {m.prixVente != null ? ` · vendu ${formatFCFA(m.prixVente)}` : ' · pas de vente d’œufs'} le plateau
        </span>
      </summary>
      <div style={{ marginTop: 8 }}>
        {m.postes.map((p) => (
          <div key={p.produit.id} className="ligne" style={{ padding: '3px 0' }}>
            <span>{p.produit.nom}</span>
            <span>{formatFCFA(p.parPlateau)} <span className="discret">/ plateau · {Math.round((p.montant / m.depenses) * 100)} %</span></span>
          </div>
        ))}
        <p className="discret" style={{ marginBottom: 0 }}>
          {formatFCFA(m.depenses)} de dépenses pour {m.plateaux} plateaux{' '}
          {m.base === 'ponte' ? 'produits (ponte saisie chaque jour).' : 'vendus : la ponte n’était pas saisie tous les jours ce mois-là.'}
        </p>
      </div>
    </details>
  )
}

function Exclusions({ exclus }: { exclus: string[] }) {
  const { produits, enregistrer } = useDonnees()
  const depenses = produits.filter((p) => p.type === 'depense' && !p.supprime_le && (p.actif || exclus.includes(p.id))).sort((a, b) => a.nom.localeCompare(b.nom))
  const basculer = (id: string, compte: boolean) =>
    enregistrer('reglages', { id: 1, couts_exclus: compte ? exclus.filter((x) => x !== id) : [...exclus, id] })
  return (
    <details className="avance carte">
      <summary>Ce qui compte dans le prix de revient</summary>
      <p className="discret">Décochez ce qui ne sert pas aux pondeuses (poulets de chair, moutons, gros équipement…).</p>
      {depenses.map((p) => (
        <label key={p.id} className="case">
          <input type="checkbox" checked={!exclus.includes(p.id)} onChange={(e) => basculer(p.id, e.target.checked)} />
          <span>{p.nom}</span>
        </label>
      ))}
    </details>
  )
}

export function Couts() {
  const { transactions, ponte, produits, reglages } = useDonnees()
  const exclus = produitsExclus(produits, reglages[0]?.couts_exclus)
  const liste = prixDeRevient({ transactions, pontes: ponte, produits, exclus }, aujourdhui())
  const moyenne = moyenneCouts(liste.slice(0, MOIS_MOYENNE))

  return (
    <main>
      <Titre genre="couts">Prix de revient</Titre>
      {!moyenne ? <EtatVide genre="couts" message="Pas encore assez de ventes et de dépenses pour calculer le prix d’un plateau." /> : (
        <section aria-label="Sur 3 mois" className="vedette">
          <div className="discret">Sur les {MOIS_MOYENNE} derniers mois, un plateau vous coûte</div>
          <div className="grand">{formatFCFA(moyenne.coutPlateau)}</div>
          {moyenne.prixVente != null && (
            <div className="variation">
              vendu {formatFCFA(moyenne.prixVente)} en moyenne · marge {moyenne.marge! >= 0 ? '+' : ''}{formatFCFA(moyenne.marge!)} par plateau
            </div>
          )}
        </section>
      )}
      <p className="discret">
        Toutes les dépenses des pondeuses (aliment, salaires, soins, carburant…) divisées par les plateaux. Touchez un mois pour voir le détail.
      </p>
      {liste.filter((m) => m.depenses > 0 || m.prixVente != null).map((m) => <LigneMois key={m.mois} m={m} />)}
      <Exclusions exclus={exclus} />
    </main>
  )
}
