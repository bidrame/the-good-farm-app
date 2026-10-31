import { useState } from 'react'
import type { Bande } from '../../lib/types'
import { ChampMontant } from '../composants/communs'
import { Link, useParams } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useDonnees } from '../../data/useDonnees'
import { LIBELLE_PHASE, ageSemaines, ecartRecomptage, effectifActuel, phase } from '../../lib/calculs/bandes'
import { indiceConso } from '../../lib/calculs/ponte'
import { serieOeufs } from '../../lib/calculs/suiviOeufs'
import { aujourdhui, formatDate } from '../../lib/format'
import { couleur } from '../couleurs'

function ModifierBande({ b, onFini }: { b: Bande; onFini: () => void }) {
  const { enregistrer, ouvriers } = useDonnees()
  const [nom, setNom] = useState(b.nom)
  const [naissance, setNaissance] = useState(b.date_naissance)
  const [effectif, setEffectif] = useState<number | null>(b.effectif_initial)
  const [reforme, setReforme] = useState(b.date_reforme ?? '')
  const [ouvrier, setOuvrier] = useState(b.ouvrier_id ?? '')
  const [erreur, setErreur] = useState<string | null>(null)
  return (
    <form aria-label="Modifier la bande" className="carte" onSubmit={async (e) => {
      e.preventDefault()
      if (!nom.trim() || !naissance || !effectif) return setErreur('Nom, date de naissance et effectif sont obligatoires.')
      if (reforme && reforme < naissance) return setErreur('La réforme ne peut pas précéder la naissance.')
      await enregistrer('bandes', { ...b, nom: nom.trim(), date_naissance: naissance, effectif_initial: effectif, date_reforme: reforme || null, ouvrier_id: ouvrier || null })
      onFini()
    }}>
      <label>Nom<input value={nom} onChange={(e) => setNom(e.target.value)} /></label>
      <label>Date de naissance<input type="date" value={naissance} onChange={(e) => setNaissance(e.target.value)} /></label>
      <ChampMontant libelle="Effectif initial" valeur={effectif} onChange={setEffectif} />
      <label>Date de réforme<input type="date" value={reforme} onChange={(e) => setReforme(e.target.value)} /></label>
      <label>
        Ouvrier
        <select value={ouvrier} onChange={(e) => setOuvrier(e.target.value)}>
          <option value="">—</option>
          {ouvriers.filter((o) => !o.supprime_le).map((o) => <option key={o.id} value={o.id}>{o.nom}</option>)}
        </select>
      </label>
      {erreur && <div className="erreur">{erreur}</div>}
      <div className="grille2">
        <button type="button" onClick={onFini}>Annuler</button>
        <button className="principal">Enregistrer</button>
      </div>
    </form>
  )
}

function Recompter({ b, onFini }: { b: Bande; onFini: () => void }) {
  const { enregistrer } = useDonnees()
  const [date, setDate] = useState(aujourdhui())
  const [effectif, setEffectif] = useState<number | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  return (
    <form aria-label="Recompter la bande" className="carte" onSubmit={async (e) => {
      e.preventDefault()
      if (effectif == null) return setErreur('Indiquez le nombre de poules comptées.')
      await enregistrer('recensements', { bande_id: b.id, date, effectif })
      onFini()
    }}>
      <p className="discret" style={{ marginTop: 0 }}>Comptez les poules du box : l’effectif repartira de ce nombre, et l’écart sera noté comme poules manquantes.</p>
      <label>Date du comptage<input type="date" value={date} max={aujourdhui()} min={b.date_naissance} onChange={(e) => setDate(e.target.value)} /></label>
      <ChampMontant libelle="Poules comptées" valeur={effectif} onChange={setEffectif} erreur={erreur ?? undefined} />
      <div className="grille2">
        <button type="button" onClick={onFini}>Annuler</button>
        <button className="principal">Enregistrer le comptage</button>
      </div>
    </form>
  )
}

export function BandeFiche() {
  const { id } = useParams()
  const { bandes, ponte, recensements, ouvriers, enregistrer } = useDonnees()
  const [recompte, setRecompte] = useState(false)
  const [reforme, setReforme] = useState(false)
  const [edition, setEdition] = useState(false)
  const [dateReforme, setDateReforme] = useState('')
  const b = bandes.find((x) => x.id === id)
  if (!b) return <main><p>Bande introuvable.</p><Link to="/bandes">Retour</Link></main>

  const ref = aujourdhui()
  const semaines = ageSemaines(b, ref)
  const sienne = ponte.filter((p) => p.bande_id === b.id && !p.supprime_le)
  const mortalite = sienne.reduce((s, p) => s + p.mortalite, 0)
  const aliment = sienne.reduce((s, p) => s + (p.aliment_kg ?? 0), 0)
  const oeufs = sienne.reduce((s, p) => s + p.oeufs_collectes, 0)
  const ic = indiceConso(aliment || null, oeufs)
  const serie = serieOeufs(b.id, ponte).map((p) => ({ ...p, moyenne7: p.moyenne7 == null ? null : Math.round(p.moyenne7) }))
  const sesRecomptages = recensements.filter((r) => r.bande_id === b.id && !r.supprime_le).sort((x, y) => y.date.localeCompare(x.date))
  const ouvrier = ouvriers.find((o) => o.id === b.ouvrier_id)

  const chiffres: [string, string][] = [
    ['Box', String(b.box)],
    ['Née le', formatDate(b.date_naissance)],
    ['Âge', `${semaines} semaines`],
    ['Phase', b.date_reforme ? `Réformée le ${formatDate(b.date_reforme)}` : LIBELLE_PHASE[phase(semaines)]],
    ['Effectif initial', String(b.effectif_initial)],
    ['Effectif actuel', String(effectifActuel(b, ponte, undefined, recensements))],
    ['Mortalité cumulée', String(mortalite)],
    ['Aliment consommé', `${aliment} kg`],
    ['Indice de consommation', ic == null ? '—' : `${Math.round(ic)} g/œuf`],
    ['Ouvrier', ouvrier?.nom ?? '—'],
  ]

  return (
    <main>
      <Link to="/bandes" className="discret">← Bandes</Link>
      <h1>{b.nom}</h1>
      <div className="carte">
        {chiffres.map(([l, v]) => (
          <div className="ligne" key={l}><span className="discret">{l}</span><span>{v}</span></div>
        ))}
      </div>

      <h2>Œufs ramassés par jour</h2>
      <div className="carte" data-testid="courbe" style={{ height: 240 }}>
        {serie.length === 0 ? <p className="discret">Pas encore de ponte saisie.</p> : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={serie} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={couleur('--bord', '#d9d7cf')} />
              <XAxis dataKey="date" tickFormatter={(d: string) => formatDate(d).slice(0, 5)} tick={{ fontSize: 11, fill: couleur('--texte-2', '#5f5e5a') }} minTickGap={24} />
              <YAxis tick={{ fontSize: 11, fill: couleur('--texte-2', '#5f5e5a') }} />
              <Tooltip formatter={(v: number, n: string) => [`${v} œufs`, n === 'oeufs' ? 'Ramassés' : 'Moyenne 7 jours']} labelFormatter={(d: string) => formatDate(d)} />
              <Line type="monotone" dataKey="moyenne7" stroke={couleur('--texte-2', '#5f5e5a')} strokeDasharray="4 4" dot={false} isAnimationActive={false} connectNulls />
              <Line type="monotone" dataKey="oeufs" stroke={couleur('--vert')} dot={false} strokeWidth={2} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {!b.date_reforme && !recompte && <button onClick={() => setRecompte(true)} style={{ width: '100%', marginBottom: 8 }}>Recompter la bande</button>}
      {recompte && <Recompter b={b} onFini={() => setRecompte(false)} />}
      {sesRecomptages.length > 0 && (
        <section aria-label="Recomptages" className="carte">
          <h2 style={{ marginTop: 0 }}>Recomptages</h2>
          {sesRecomptages.map((r) => {
            const ecart = ecartRecomptage(b, ponte, r, recensements)
            return (
              <div className="ligne" key={r.id}>
                <span><span className="discret">{formatDate(r.date)}</span> {r.effectif} poules</span>
                <span className={ecart > 0 ? 'mauvais' : 'ok'}>{ecart > 0 ? `${ecart} manquantes` : ecart < 0 ? `${-ecart} de plus` : 'conforme'}</span>
              </div>
            )
          })}
        </section>
      )}
      {!edition && <button onClick={() => setEdition(true)} style={{ width: '100%', marginBottom: 8 }}>Modifier</button>}
      {edition && <ModifierBande b={b} onFini={() => setEdition(false)} />}
      {!b.date_reforme && !reforme && !edition && <button onClick={() => setReforme(true)} style={{ width: '100%' }}>Réformer</button>}
      {reforme && (
        <div className="carte">
          <label>Date de réforme<input type="date" value={dateReforme} min={b.date_naissance} max={ref} onChange={(e) => setDateReforme(e.target.value)} /></label>
          <div className="grille2">
            <button onClick={() => setReforme(false)}>Annuler</button>
            <button className="principal" disabled={!dateReforme} onClick={async () => {
              await enregistrer('bandes', { ...b, date_reforme: dateReforme })
              setReforme(false)
            }}>Confirmer la réforme</button>
          </div>
        </div>
      )}
    </main>
  )
}
