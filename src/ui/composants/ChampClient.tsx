import { useState } from 'react'
import { cleNom } from '../../lib/calculs/doublons'
import type { Client } from '../../lib/types'

const MAX_SUGGESTIONS = 6

/** Recherche d'un client dès 2 lettres ; ajout rapide sans doublon possible. */
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
  const recherche = cleNom(texte)
  const actifs = clients.filter((c) => !c.supprime_le)
  const suggestions = recherche.length >= 2 ? actifs.filter((c) => cleNom(c.nom).includes(recherche)).slice(0, MAX_SUGGESTIONS) : []
  const existeDeja = actifs.some((c) => cleNom(c.nom) === recherche)

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
        <input value={texte} onChange={(e) => setTexte(e.target.value)} autoComplete="off" aria-invalid={!!erreur} />
      </label>
      {(suggestions.length > 0 || (recherche.length >= 2 && !existeDeja)) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: -4, marginBottom: 6 }}>
          {suggestions.map((c) => (
            <button type="button" key={c.id} onClick={() => onChange(c.id)}>{c.nom}</button>
          ))}
          {!existeDeja && recherche.length >= 2 && (
            <button type="button" onClick={() => onAjouter(texte.trim())}>{`Ajouter « ${texte.trim()} »`}</button>
          )}
        </div>
      )}
      {erreur && <div className="erreur">{erreur}</div>}
    </div>
  )
}
