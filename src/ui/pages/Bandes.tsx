import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDonnees } from '../../data/useDonnees'
import { tauxMoyen } from '../../lib/calculs/alertes'
import { LIBELLE_PHASE, ageSemaines, effectifActuel, phase } from '../../lib/calculs/bandes'
import { ajouterJours, aujourdhui, formatDate } from '../../lib/format'
import type { Bande, Box } from '../../lib/types'
import { ChampMontant } from '../composants/communs'

const BOXES: Box[] = [1, 2, 3, 4]

function LigneBande({ b }: { b: Bande }) {
  const { ponte } = useDonnees()
  const ref = aujourdhui()
  const semaines = ageSemaines(b, ref)
  const taux = b.date_reforme ? null : tauxMoyen(b, ponte, ajouterJours(ref, -6), ref)
  return (
    <Link to={`/bandes/${b.id}`} className="carte" style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
      <div className="ligne" style={{ padding: 0 }}>
        <strong>{b.nom}</strong>
        <span className="discret">box {b.box}</span>
      </div>
      <div className="discret">
        {semaines} sem. · {b.date_reforme ? `réformée le ${formatDate(b.date_reforme)}` : LIBELLE_PHASE[phase(semaines)]} · {effectifActuel(b, ponte)} poules
        {taux != null && ` · ${Math.round(taux * 100)} % sur 7 j`}
      </div>
    </Link>
  )
}

function NouvelleBande({ libres, onFini }: { libres: Box[]; onFini: () => void }) {
  const { enregistrer, ouvriers } = useDonnees()
  const [nom, setNom] = useState('')
  const [box, setBox] = useState<Box | null>(libres[0] ?? null)
  const [naissance, setNaissance] = useState('')
  const [effectif, setEffectif] = useState<number | null>(null)
  const [ouvrier, setOuvrier] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)

  if (libres.length === 0) return <p className="alerte info">Aucun box libre : réformez d’abord une bande.</p>

  async function creer() {
    if (!nom.trim() || !box || !naissance || !effectif || effectif <= 0) {
      setErreur('Nom, box, date de naissance et effectif sont obligatoires.')
      return
    }
    if (naissance > aujourdhui()) {
      setErreur('Date de naissance dans le futur.')
      return
    }
    await enregistrer('bandes', { nom: nom.trim(), box, date_naissance: naissance, effectif_initial: effectif, ouvrier_id: ouvrier || null, date_reforme: null })
    onFini()
  }

  return (
    <div className="carte">
      <label>Nom<input value={nom} onChange={(e) => setNom(e.target.value)} /></label>
      <label>
        Box
        <select value={box ?? ''} onChange={(e) => setBox(Number(e.target.value) as Box)}>
          {libres.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <label>Date de naissance<input type="date" value={naissance} max={aujourdhui()} onChange={(e) => setNaissance(e.target.value)} /></label>
      <ChampMontant libelle="Effectif initial" valeur={effectif} onChange={setEffectif} />
      <label>
        Ouvrier
        <select value={ouvrier} onChange={(e) => setOuvrier(e.target.value)}>
          <option value="">—</option>
          {ouvriers.filter((o) => o.actif && !o.supprime_le).map((o) => <option key={o.id} value={o.id}>{o.nom}</option>)}
        </select>
      </label>
      {erreur && <div className="erreur">{erreur}</div>}
      <button className="principal" onClick={creer}>Créer la bande</button>
    </div>
  )
}

export function Bandes() {
  const { bandes } = useDonnees()
  const [creation, setCreation] = useState(false)
  const visibles = bandes.filter((b) => !b.supprime_le)
  const actives = visibles.filter((b) => !b.date_reforme).sort((a, b) => a.box - b.box)
  const reformees = visibles.filter((b) => b.date_reforme).sort((a, b) => a.nom.localeCompare(b.nom))
  const libres = BOXES.filter((n) => !actives.some((b) => b.box === n))
  return (
    <main>
      <h1>Bandes</h1>
      {actives.map((b) => <LigneBande key={b.id} b={b} />)}
      <button onClick={() => setCreation((c) => !c)} style={{ width: '100%', marginBottom: 10 }}>Nouvelle bande</button>
      {creation && <NouvelleBande libres={libres} onFini={() => setCreation(false)} />}
      {reformees.length > 0 && (
        <section aria-label="Bandes réformées">
          <h2>Bandes réformées</h2>
          {reformees.map((b) => <LigneBande key={b.id} b={b} />)}
        </section>
      )}
    </main>
  )
}
