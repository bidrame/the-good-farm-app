import type { Produit, Transaction, TypeTx } from '../../lib/types'

const NB_FREQUENTS = 4

export function produitsFrequents(produits: Produit[], txs: Transaction[], type: TypeTx): Produit[] {
  const compte = new Map<string, number>()
  for (const t of txs) if (!t.supprime_le && t.type === type) compte.set(t.produit_id, (compte.get(t.produit_id) ?? 0) + 1)
  return produits
    .filter((p) => p.type === type && p.actif && !p.supprime_le)
    .sort((a, b) => (compte.get(b.id) ?? 0) - (compte.get(a.id) ?? 0) || a.nom.localeCompare(b.nom))
}

export function BoutonsProduits({ produits, transactions, type, valeur, onChange, erreur }: {
  produits: Produit[]
  transactions: Transaction[]
  type: TypeTx
  valeur: string | null
  onChange: (id: string) => void
  erreur?: string
}) {
  const tous = produitsFrequents(produits, transactions, type)
  const frequents = tous.slice(0, NB_FREQUENTS)
  const autres = tous.slice(NB_FREQUENTS)
  const choisiAilleurs = autres.find((p) => p.id === valeur)
  return (
    <div style={{ marginBottom: 8 }}>
      <div role="group" aria-label="Produit">
        <span className="discret">Produit</span>
        <div className="grille2" style={{ marginTop: 4 }}>
          {frequents.map((p) => (
            <button type="button" key={p.id} className={p.id === valeur ? 'choisi' : ''} onClick={() => onChange(p.id)}>{p.nom}</button>
          ))}
          <button type="button" className={choisiAilleurs ? 'choisi' : ''} onClick={() => onChange('')}>Plus de choix…</button>
        </div>
      </div>
      {(valeur === '' || choisiAilleurs) && (
        <label style={{ marginTop: 8 }}>
          Autres choix
          <select value={valeur ?? ''} onChange={(e) => onChange(e.target.value)}>
            <option value="">Choisir…</option>
            {autres.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>
        </label>
      )}
      {erreur && <div className="erreur">{erreur}</div>}
    </div>
  )
}
