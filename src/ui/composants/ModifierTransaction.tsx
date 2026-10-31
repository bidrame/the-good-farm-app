import { useState } from 'react'
import { useDonnees } from '../../data/useDonnees'
import { validerTransaction } from '../../lib/calculs/credits'
import { aujourdhui } from '../../lib/format'
import type { Transaction } from '../../lib/types'
import { ChampMontant } from './communs'

export function ModifierTransaction({ t, onFini }: { t: Transaction; onFini: () => void }) {
  const { enregistrer } = useDonnees()
  const [date, setDate] = useState(t.date)
  const [quantite, setQuantite] = useState<number | null>(t.quantite)
  const [prix, setPrix] = useState<number | null>(t.prix_unitaire)
  const [paye, setPaye] = useState<number | null>(t.montant_paye)
  const [observation, setObservation] = useState(t.observation ?? '')
  const [erreurs, setErreurs] = useState<Record<string, string>>({})
  const montant = (quantite ?? 0) * (prix ?? 0)

  async function valider() {
    const nouvelle: Transaction = {
      ...t, date, quantite: quantite ?? 0, prix_unitaire: prix ?? 0, montant,
      montant_paye: t.type === 'vente' ? paye ?? 0 : 0, observation: observation.trim() || null,
    }
    const e = validerTransaction(nouvelle, aujourdhui())
    setErreurs(e)
    if (Object.keys(e).length > 0) return
    await enregistrer('transactions', { ...nouvelle })
    onFini()
  }

  return (
    <form aria-label="Modifier la saisie" className="carte" onSubmit={(e) => { e.preventDefault(); void valider() }}>
      <label>Date<input type="date" value={date} max={aujourdhui()} onChange={(e) => setDate(e.target.value)} /></label>
      <div className="grille2">
        <ChampMontant libelle="Quantité" valeur={quantite} onChange={setQuantite} erreur={erreurs.quantite} />
        <ChampMontant libelle="Prix unitaire" valeur={prix} onChange={setPrix} erreur={erreurs.prix_unitaire} />
      </div>
      {t.type === 'vente' && <ChampMontant libelle="Montant payé" valeur={paye} onChange={setPaye} erreur={erreurs.montant_paye} />}
      <label>Observation<textarea rows={2} value={observation} onChange={(e) => setObservation(e.target.value)} /></label>
      <div className="grille2">
        <button type="button" onClick={onFini}>Annuler</button>
        <button className="principal">Enregistrer</button>
      </div>
    </form>
  )
}
