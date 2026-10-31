import { useState } from 'react'
import { useDonnees } from '../../data/useDonnees'
import { dernierPrix, validerTransaction } from '../../lib/calculs/credits'
import { estDoublonTransaction } from '../../lib/calculs/doublons'
import { aujourdhui, formatFCFA } from '../../lib/format'
import type { Transaction, TypeTx, Unite } from '../../lib/types'
import { BoutonsProduits } from '../composants/BoutonsProduits'
import { ChampClient } from '../composants/ChampClient'
import { ChampMontant, Confirmation } from '../composants/communs'
import { useBrouillon } from '../useBrouillon'

type Paye = 'tout' | 'partie' | 'rien'

type Formulaire = {
  id: string
  type: TypeTx
  date: string
  client_id: string | null
  produit_id: string | null
  quantite: number | null
  prix_unitaire: number | null
  paye: Paye
  montant_paye: number | null
  observation: string
}

const vide = (type: TypeTx = 'vente'): Formulaire => ({
  id: crypto.randomUUID(), type, date: aujourdhui(), client_id: null, produit_id: null, quantite: null, prix_unitaire: null, paye: 'tout', montant_paye: null, observation: '',
})

/** Un brouillon est « commencé » dès qu'un client, un produit, une quantité ou un prix y figure. */
const commence = (b: Formulaire) => !!(b.client_id || b.produit_id || b.quantite || b.prix_unitaire)

const UNITE: Record<Unite, string> = { plaque: 'plaque', unite: 'unité', kg: 'kg', forfait: 'forfait', autre: 'unité' }

export function Saisir() {
  const { clients, produits, transactions, enregistrer } = useDonnees()
  const [f, setF, effacer] = useBrouillon<Formulaire>('brouillon-saisie', () => vide(), (b) => ({
    ...b,
    id: b.id ?? crypto.randomUUID(),
    date: commence(b) ? b.date : aujourdhui(),
  }))
  const [enCours, setEnCours] = useState(false)
  const [erreurs, setErreurs] = useState<Record<string, string>>({})
  const [doublon, setDoublon] = useState<Transaction | null>(null)
  const [fait, setFait] = useState(false)

  const maj = (p: Partial<Formulaire>) => setF((x) => ({ ...x, ...p }))
  const produit = produits.find((p) => p.id === f.produit_id)
  const montant = (f.quantite ?? 0) * (f.prix_unitaire ?? 0)
  const montantPaye = f.type === 'depense' ? 0 : f.paye === 'tout' ? montant : f.paye === 'rien' ? 0 : f.montant_paye ?? 0

  const prixPropose = (clientId: string | null, produitId: string | null) =>
    produitId ? dernierPrix(transactions, clientId, produitId) ?? dernierPrixProduit(produitId) : null
  const dernierPrixProduit = (produitId: string) =>
    transactions.filter((t) => t.produit_id === produitId && !t.supprime_le).sort((a, b) => b.date.localeCompare(a.date))[0]?.prix_unitaire ?? null

  function choisirClient(id: string | null) {
    maj({ client_id: id, ...(f.produit_id && id ? { prix_unitaire: prixPropose(id, f.produit_id) } : {}) })
  }

  function choisirProduit(id: string) {
    maj({ produit_id: id, prix_unitaire: id ? prixPropose(f.client_id, id) : null })
  }

  async function ajouterClient(nom: string) {
    const id = crypto.randomUUID()
    await enregistrer('clients', { id, nom })
    choisirClient(id)
  }

  function construire(): Transaction {
    return {
      id: f.id, date: f.date, type: f.type, client_id: f.client_id, produit_id: f.produit_id ?? '',
      prix_unitaire: f.prix_unitaire ?? 0, quantite: f.quantite ?? 0, montant, montant_paye: montantPaye,
      observation: f.observation.trim() || null,
    }
  }

  async function valider(forcer = false) {
    if (enCours) return
    const t = construire()
    const e = validerTransaction(t, aujourdhui())
    setErreurs(e)
    if (Object.keys(e).length > 0) return
    if (!forcer && estDoublonTransaction(t, transactions)) {
      setDoublon(t)
      return
    }
    setDoublon(null)
    setEnCours(true)
    try {
      await enregistrer('transactions', { ...t })
      effacer()
      setFait(true)
    } finally {
      setEnCours(false)
    }
  }

  if (fait)
    return (
      <main>
        <div className="carte" style={{ textAlign: 'center' }}>
          <p className="ok" style={{ fontSize: 18 }}>Enregistré ✓</p>
          <button className="principal" onClick={() => { setFait(false); setErreurs({}) }}>Nouvelle saisie</button>
        </div>
      </main>
    )

  const unite = produit ? UNITE[produit.unite] : 'unité'

  return (
    <main>
      <div className="grille2" style={{ marginBottom: 12 }}>
        {(['vente', 'depense'] as const).map((t) => (
          <button key={t} type="button" className={f.type === t ? 'choisi' : ''} onClick={() => { setF(vide(t)); setErreurs({}) }}>
            {t === 'vente' ? 'Vente' : 'Dépense'}
          </button>
        ))}
      </div>

      <label>
        Date
        <input type="date" value={f.date} max={aujourdhui()} onChange={(e) => maj({ date: e.target.value })} />
        {erreurs.date && <div className="erreur">{erreurs.date}</div>}
      </label>

      <ChampClient
        libelle={f.type === 'vente' ? 'Client' : 'Fournisseur (facultatif)'}
        clients={clients}
        valeur={f.client_id}
        onChange={choisirClient}
        onAjouter={ajouterClient}
        erreur={erreurs.client_id}
      />

      <BoutonsProduits produits={produits} transactions={transactions} type={f.type} valeur={f.produit_id} onChange={choisirProduit} erreur={erreurs.produit_id} />

      <div className="grille2">
        <ChampMontant libelle="Quantité" valeur={f.quantite} onChange={(n) => maj({ quantite: n })} erreur={erreurs.quantite} />
        <ChampMontant libelle={`Prix / ${unite}`} valeur={f.prix_unitaire} onChange={(n) => maj({ prix_unitaire: n })} erreur={erreurs.prix_unitaire} />
      </div>

      <div className="ligne" style={{ fontWeight: 600, fontSize: 17 }}>
        <span>Montant</span>
        <span data-testid="montant">{formatFCFA(montant)}</span>
      </div>

      {f.type === 'vente' && (
        <>
          <span className="discret">Payé</span>
          <div className="grille3" style={{ margin: '4px 0 8px' }}>
            {([['tout', 'Tout'], ['partie', 'Une partie'], ['rien', 'Rien (crédit)']] as const).map(([v, l]) => (
              <button key={v} type="button" className={f.paye === v ? 'choisi' : ''} onClick={() => maj({ paye: v })}>{l}</button>
            ))}
          </div>
          {f.paye === 'partie' && (
            <>
              <ChampMontant libelle="Montant payé" valeur={f.montant_paye} onChange={(n) => maj({ montant_paye: n })} erreur={erreurs.montant_paye} />
              <div className="discret" data-testid="reste">reste {formatFCFA(Math.max(0, montant - (f.montant_paye ?? 0)))}</div>
            </>
          )}
          {f.paye !== 'partie' && erreurs.montant_paye && <div className="erreur">{erreurs.montant_paye}</div>}
        </>
      )}

      <label>
        Observation (facultatif)
        <textarea rows={2} value={f.observation} onChange={(e) => maj({ observation: e.target.value })} />
      </label>

      <button className="principal" disabled={enCours} onClick={() => valider()}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</button>

      {doublon && (
        <Confirmation
          message="Déjà saisi ? Une vente identique (même client, produit, montant et jour) existe déjà."
          oui="Enregistrer quand même"
          onOui={() => valider(true)}
          onNon={() => setDoublon(null)}
        />
      )}
    </main>
  )
}
