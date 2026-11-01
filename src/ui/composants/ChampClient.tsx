import { useState } from 'react'
import { cleNom, personnesSemblables } from '../../lib/calculs/doublons'
import { BoutonAjout } from './Pastille'
import type { Client } from '../../lib/types'

const MAX_SUGGESTIONS = 6

/** Recherche d'un client dès 2 lettres ; ajout rapide sans doublon : même nom impossible, nom proche à confirmer. */
export function ChampClient({ libelle, clients, valeur, onChange, onAjouter, erreur }: {
  libelle: string
  clients: Client[]
  valeur: string | null
  onChange: (id: string | null) => void
  onAjouter: (nom: string) => void
  erreur?: string
}) {
  const choisi = clients.find((c) => c.id === valeur)
  const [texte, setTexte] = useState('')
  const [confirmer, setConfirmer] = useState(false)
  const recherche = cleNom(texte)
  const actifs = clients.filter((c) => !c.supprime_le)
  const { identique, proches } = personnesSemblables(texte, null, clients)
  const existeDeja = !!identique
  const suggestions = recherche.length >= 2
    ? [...new Set([...actifs.filter((c) => cleNom(c.nom).includes(recherche)), ...(identique ? [identique] : []), ...proches])].slice(0, MAX_SUGGESTIONS)
    : []
  const ajouter = () => { setConfirmer(false); onAjouter(texte.trim()) }

  if (choisi)
    return (
      <div style={{ marginBottom: 8 }}>
        <span className="discret">{libelle}</span>
        <div className="ligne">
          <strong>{choisi.nom}</strong>
          <button type="button" className="lien" onClick={() => { onChange(null); setTexte('') }}>Changer</button>
        </div>
      </div>
    )

  return (
    <div style={{ marginBottom: 8 }}>
      <label>
        {libelle}
        <input value={texte} onChange={(e) => { setTexte(e.target.value); setConfirmer(false) }} autoComplete="off" aria-invalid={!!erreur} />
      </label>
      {(suggestions.length > 0 || (recherche.length >= 2 && !existeDeja)) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: -4, marginBottom: 6 }}>
          {suggestions.map((c) => (
            <button type="button" key={c.id} onClick={() => onChange(c.id)}>{c.nom}</button>
          ))}
          {!existeDeja && recherche.length >= 2 && !confirmer && (
            <BoutonAjout onClick={() => (proches.length ? setConfirmer(true) : ajouter())}>{`Ajouter « ${texte.trim()} »`}</BoutonAjout>
          )}
        </div>
      )}
      {confirmer && (
        <div role="alert" className="alerte attention" style={{ display: 'block' }}>
          <div>« {texte.trim()} » ressemble à {proches.map((p) => p.nom).join(', ')}. Si c’est la même personne, touchez son nom ci-dessus.</div>
          <div className="grille2" style={{ marginTop: 8 }}>
            <button type="button" onClick={() => setConfirmer(false)}>Annuler</button>
            <BoutonAjout onClick={ajouter}>C’est une autre personne</BoutonAjout>
          </div>
        </div>
      )}
      {erreur && <div className="erreur">{erreur}</div>}
    </div>
  )
}
