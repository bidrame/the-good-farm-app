import { IconAlertOctagon, IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react'
import { useState, type ReactNode } from 'react'
import { formatFCFA, parseMontant } from '../../lib/format'
import type { Alerte as TAlerte } from '../../lib/calculs/alertes'
import type { Genre } from '../icones'
import { Pastille } from './Pastille'

/** `hausseMauvaise` : pour les dépenses, une hausse s'affiche en rouge. */
export function CarteMetrique({ libelle, valeur, variation, hausseMauvaise = false, genre, teinteValeur }: {
  libelle: string; valeur: string; variation?: number | null; hausseMauvaise?: boolean; genre?: Genre; teinteValeur?: 'entree' | 'sortie' | 'du'
}) {
  return (
    <div className="metrique">
      {genre ? <div className="tete"><Pastille genre={genre} petite /><span className="discret">{libelle}</span></div> : <div className="discret">{libelle}</div>}
      <div className={`valeur${teinteValeur ? ` ${teinteValeur}` : ''}`}>{valeur}</div>
      {variation != null && Number.isFinite(variation) && (
        <div className={(variation >= 0) !== hausseMauvaise ? 'ok' : 'mauvais'} style={{ fontSize: 13 }}>
          {variation >= 0 ? '▲' : '▼'} {Math.abs(Math.round(variation * 100))} %
        </div>
      )}
    </div>
  )
}

const ICONE_ALERTE = { danger: IconAlertOctagon, attention: IconAlertTriangle, info: IconInfoCircle }

export function Alerte({ alerte }: { alerte: TAlerte }) {
  const Icone = ICONE_ALERTE[alerte.niveau]
  return (
    <div className={`alerte ${alerte.niveau}`} role="status">
      <Icone size={18} aria-hidden="true" />
      <span>{alerte.message}</span>
    </div>
  )
}

export function Confirmation({ message, onOui, onNon, oui = 'Confirmer', non = 'Annuler' }: { message: ReactNode; onOui: () => void; onNon: () => void; oui?: string; non?: string }) {
  return (
    <div className="voile" role="dialog" aria-modal="true">
      <div className="carte">
        <p>{message}</p>
        <div className="grille2">
          <button onClick={onNon}>{non}</button>
          <button className="principal" onClick={onOui}>{oui}</button>
        </div>
      </div>
    </div>
  )
}

/** Champ de montant ou de nombre : accepte « 2 300 », « 2.300 »… et renvoie un entier ou null. */
export function ChampMontant({ libelle, valeur, onChange, erreur, suffixe }: { libelle: string; valeur: number | null; onChange: (n: number | null) => void; erreur?: string; suffixe?: string }) {
  const [texte, setTexte] = useState(valeur == null ? '' : String(valeur))
  const [dernier, setDernier] = useState(valeur)
  if (valeur !== dernier) {
    setDernier(valeur)
    if (valeur !== parseMontant(texte)) setTexte(valeur == null ? '' : String(valeur))
  }
  return (
    <label>
      {libelle}
      <input
        inputMode="numeric"
        value={texte}
        onChange={(e) => {
          setTexte(e.target.value)
          const n = parseMontant(e.target.value)
          setDernier(n)
          onChange(n)
        }}
        aria-invalid={!!erreur}
      />
      {suffixe && <span className="discret">{suffixe}</span>}
      {(erreur || (texte.trim() !== '' && parseMontant(texte) == null)) && <div className="erreur">{erreur ?? 'Nombre entier attendu'}</div>}
    </label>
  )
}

export const fcfa = formatFCFA
