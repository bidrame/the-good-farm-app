import { useState } from 'react'
import type { Bande } from '../../lib/types'
import { ChampMontant } from '../composants/communs'
import { Link, useParams } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useDonnees } from '../../data/useDonnees'
import { LIBELLE_PHASE, ageSemaines, ecartRecomptage, phase } from '../../lib/calculs/bandes'
import { boxesFerme, ouvrierDuBox } from '../../lib/calculs/boxes'
import { fiabiliteEffectif } from '../../lib/calculs/effectifs'
import { indiceConso } from '../../lib/calculs/ponte'
import { serieOeufs } from '../../lib/calculs/suiviOeufs'
import { aujourdhui, formatDate } from '../../lib/format'
import { couleur } from '../couleurs'
import { teinteBande } from '../bandes'

function ModifierBande({ b, onFini }: { b: Bande; onFini: () => void }) {
  const { enregistrer } = useDonnees()
  const [nom, setNom] = useState(b.nom)
  const [naissance, setNaissance] = useState(b.date_naissance)
  const [effectif, setEffectif] = useState<number | null>(b.effectif_initial)
  const [reforme, setReforme] = useState(b.date_reforme ?? '')
  const [verifie, setVerifie] = useState(!!b.effectif_verifie)
  const [erreur, setErreur] = useState<string | null>(null)
  return (
    <form aria-label="Modifier la bande" className="carte" onSubmit={async (e) => {
      e.preventDefault()
      if (!nom.trim() || !naissance || !effectif) return setErreur('Nom, date de naissance et effectif sont obligatoires.')
      if (reforme && reforme < naissance) return setErreur('La réforme ne peut pas précéder la naissance.')
      await enregistrer('bandes', { ...b, nom: nom.trim(), date_naissance: naissance, effectif_initial: effectif, date_reforme: reforme || null, effectif_verifie: verifie })
      onFini()
    }}>
      <label>Nom<input value={nom} onChange={(e) => setNom(e.target.value)} /></label>
      <label>Date de naissance<input type="date" value={naissance} onChange={(e) => setNaissance(e.target.value)} /></label>
      <ChampMontant libelle="Effectif initial" valeur={effectif} onChange={setEffectif} />
      <label>Date de réforme<input type="date" value={reforme} onChange={(e) => setReforme(e.target.value)} /></label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--texte)' }}>
        <input type="checkbox" checked={verifie} onChange={(e) => setVerifie(e.target.checked)} style={{ width: 22, minHeight: 22, margin: 0 }} />
        Effectif compté (vérifié)
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

function DeclarerMorts({ b, onFini }: { b: Bande; onFini: () => void }) {
  const { enregistrer } = useDonnees()
  const [date, setDate] = useState(aujourdhui())
  const [nombre, setNombre] = useState<number | null>(null)
  const [observation, setObservation] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  return (
    <form aria-label="Déclarer des morts" className="carte" onSubmit={async (e) => {
      e.preventDefault()
      if (!nombre || nombre <= 0) return setErreur('Indiquez le nombre de morts.')
      await enregistrer('mortalites', { bande_id: b.id, date, nombre, observation: observation.trim() || null })
      onFini()
    }}>
      <p className="discret" style={{ marginTop: 0 }}>Pour les morts constatées en dehors de la saisie de ponte. Elles sont retirées de l’effectif.</p>
      <div className="grille2">
        <label>Date<input type="date" value={date} max={aujourdhui()} min={b.date_naissance} onChange={(e) => setDate(e.target.value)} /></label>
        <ChampMontant libelle="Nombre de morts" valeur={nombre} onChange={setNombre} erreur={erreur ?? undefined} />
      </div>
      <label>Cause ou remarque (facultatif)<input value={observation} onChange={(e) => setObservation(e.target.value)} /></label>
      <div className="grille2">
        <button type="button" onClick={onFini}>Annuler</button>
        <button className="principal">Enregistrer les morts</button>
      </div>
    </form>
  )
}

/** Avis quand l'effectif n'a pas été compté, ou que la ponte le contredit. */
function AvisEffectif({ b, onRecompter }: { b: Bande; onRecompter: () => void }) {
  const { ponte, recensements, mortalites, reglages } = useDonnees()
  const f = fiabiliteEffectif(b, { pontes: ponte, recensements, mortalites }, aujourdhui(), reglages[0]?.courbe_attendue)
  if (b.date_reforme || (f.verifie && !f.incoherent)) return null
  const estimation = f.estime != null ? ` Il y aurait ≈ ${f.estime} poules d’après la ponte et l’âge de la bande.` : ''
  const message = f.oeufsJour != null && f.oeufsJour > f.note
    ? `${f.oeufsJour} œufs par jour pour ${f.note} poules notées : c’est impossible, l’effectif noté est faux.${estimation}`
    : f.incoherent
      ? `L’effectif noté (${f.note}) est loin de ce que donne la ponte.${estimation}`
      : `Effectif jamais compté : ${f.note} poules notées.${estimation}`
  return (
    <div className="alerte attention" role="status" aria-label="Effectif à vérifier" style={{ flexDirection: 'column' }}>
      <strong>Effectif à vérifier</strong>
      <span style={{ fontWeight: 600 }}>{message} Comptez les poules du box et enregistrez le comptage : les taux de ponte deviendront fiables.</span>
      <button className="lien" onClick={onRecompter}>Recompter maintenant</button>
    </div>
  )
}

export function BandeFiche() {
  const { id } = useParams()
  const { bandes, ponte, recensements, mortalites, ouvriers, reglages, enregistrer, supprimer } = useDonnees()
  const [recompte, setRecompte] = useState(false)
  const [morts, setMorts] = useState(false)
  const [reforme, setReforme] = useState(false)
  const [edition, setEdition] = useState(false)
  const [dateReforme, setDateReforme] = useState('')
  const b = bandes.find((x) => x.id === id)
  if (!b) return <main><p>Bande introuvable.</p><Link to="/bandes">Retour</Link></main>

  const ref = aujourdhui()
  const semaines = ageSemaines(b, ref)
  const sienne = ponte.filter((p) => p.bande_id === b.id && !p.supprime_le)
  const mortalite = sienne.reduce((s, p) => s + p.mortalite, 0) + mortalites.filter((m) => m.bande_id === b.id && !m.supprime_le).reduce((s, m) => s + m.nombre, 0)
  const aliment = sienne.reduce((s, p) => s + (p.aliment_kg ?? 0), 0)
  const oeufs = sienne.reduce((s, p) => s + p.oeufs_collectes, 0)
  const ic = indiceConso(aliment || null, oeufs)
  const serie = serieOeufs(b.id, ponte).map((p) => ({ ...p, moyenne7: p.moyenne7 == null ? null : Math.round(p.moyenne7) }))
  const sesMorts = mortalites.filter((m) => m.bande_id === b.id && !m.supprime_le).sort((x, y) => y.date.localeCompare(x.date))
  const sesRecomptages = recensements.filter((r) => r.bande_id === b.id && !r.supprime_le).sort((x, y) => y.date.localeCompare(x.date))
  const ouvrier = ouvriers.find((o) => o.id === (b.date_reforme ? b.ouvrier_id : ouvrierDuBox(boxesFerme(reglages[0], bandes), b.box)))
  const f = fiabiliteEffectif(b, { pontes: ponte, recensements, mortalites }, ref, reglages[0]?.courbe_attendue)

  const chiffres: [string, string][] = [
    ['Box', String(b.box)],
    ['Née le', formatDate(b.date_naissance)],
    ['Âge', `${semaines} semaines`],
    ['Phase', b.date_reforme ? `Réformée le ${formatDate(b.date_reforme)}` : LIBELLE_PHASE[phase(semaines)]],
    ['Effectif initial', `${b.effectif_initial}${f.verifie ? '' : ' (non compté)'}`],
    ['Effectif actuel', String(f.note)],
    ...(!f.verifie && f.estime != null ? [['Estimé d’après la ponte', `≈ ${f.estime}`] as [string, string]] : []),
    ['Mortalité cumulée', String(mortalite)],
    ['Aliment consommé', `${aliment} kg`],
    ['Indice de consommation', ic == null ? '—' : `${Math.round(ic)} g/œuf`],
    ['Ouvrier', ouvrier?.nom ?? '—'],
  ]

  return (
    <main>
      <Link to="/bandes" className="discret">← Bandes</Link>
      <h1 className="titre"><span className="pastille" style={{ background: teinteBande(b) }} aria-hidden="true" />{b.nom}</h1>
      <AvisEffectif b={b} onRecompter={() => setRecompte(true)} />
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
      {!b.date_reforme && !morts && <button onClick={() => setMorts(true)} style={{ width: '100%', marginBottom: 8 }}>Déclarer des morts</button>}
      {morts && <DeclarerMorts b={b} onFini={() => setMorts(false)} />}
      {sesMorts.length > 0 && (
        <section aria-label="Morts déclarées" className="carte">
          <h2 style={{ marginTop: 0 }}>Morts déclarées</h2>
          {sesMorts.map((m) => (
            <div className="ligne" key={m.id}>
              <span><span className="discret">{formatDate(m.date)}</span> {m.nombre} mort{m.nombre > 1 ? 's' : ''}{m.observation ? <span className="discret"> · {m.observation}</span> : null}</span>
              <button className="lien" aria-label={`Supprimer les morts du ${formatDate(m.date)}`} onClick={() => supprimer('mortalites', m.id)}>Supprimer</button>
            </div>
          ))}
        </section>
      )}
      {sesRecomptages.length > 0 && (
        <section aria-label="Recomptages" className="carte">
          <h2 style={{ marginTop: 0 }}>Recomptages</h2>
          {sesRecomptages.map((r) => {
            const ecart = ecartRecomptage(b, ponte, r, recensements, mortalites)
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
