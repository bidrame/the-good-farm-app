import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDonnees } from '../../data/useDonnees'
import { LIBELLE_PHASE, ageSemaines, phase } from '../../lib/calculs/bandes'
import { boxesFerme, ouvrierDuBox } from '../../lib/calculs/boxes'
import { fiabiliteEffectif } from '../../lib/calculs/effectifs'
import { ajouterJours, aujourdhui, formatDate } from '../../lib/format'
import type { Bande, Box, BoxFerme } from '../../lib/types'
import { ChampMontant } from '../composants/communs'
import { Titre } from '../composants/Pastille'
import { teinteBande } from '../bandes'


function LigneBande({ b }: { b: Bande }) {
  const { ponte, recensements, mortalites, reglages, ouvriers, bandes } = useDonnees()
  const ref = aujourdhui()
  const semaines = ageSemaines(b, ref)
  const recents = b.date_reforme ? [] : ponte.filter((p) => p.bande_id === b.id && !p.supprime_le && p.date >= ajouterJours(ref, -6) && p.date <= ref)
  const oeufsJour = recents.length ? Math.round(recents.reduce((s, p) => s + p.oeufs_collectes, 0) / recents.length) : null
  const f = fiabiliteEffectif(b, { pontes: ponte, recensements, mortalites }, ref, reglages[0]?.courbe_attendue)
  const ouvrier = b.date_reforme ? undefined : ouvriers.find((o) => o.id === ouvrierDuBox(boxesFerme(reglages[0], bandes), b.box))
  return (
    <Link to={`/bandes/${b.id}`} className="carte bordure-bande" style={{ display: 'block', color: 'inherit', textDecoration: 'none', borderLeftColor: teinteBande(b) }}>
      <div className="ligne" style={{ padding: 0 }}>
        <strong>{b.nom}</strong>
        <span className="discret">box {b.box}{ouvrier ? ` · ${ouvrier.nom}` : ''}</span>
      </div>
      <div className="discret">
        {oeufsJour != null && <strong style={{ color: 'var(--texte)' }}>{oeufsJour} œufs/jour · </strong>}
        {semaines} sem. · {b.date_reforme ? `réformée le ${formatDate(b.date_reforme)}` : LIBELLE_PHASE[phase(semaines)]}
        {!b.date_reforme && (f.incoherent && f.estime != null
          ? <> · effectif <strong className="du">à vérifier</strong> (≈ {f.estime} d’après la ponte)</>
          : <> · ≈ {f.note} poules{!f.verifie && <span className="du"> · à vérifier</span>}</>)}
      </div>
    </Link>
  )
}

function NouvelleBande({ libres, boxes, onFini }: { libres: Box[]; boxes: BoxFerme[]; onFini: () => void }) {
  const { enregistrer } = useDonnees()
  const [nom, setNom] = useState('')
  const [box, setBox] = useState<Box | null>(libres[0] ?? null)
  const [naissance, setNaissance] = useState('')
  const [effectif, setEffectif] = useState<number | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  if (libres.length === 0) return <p className="alerte info">Aucun box libre : ajoutez un box ou réformez d’abord une bande.</p>

  async function creer() {
    if (!nom.trim() || !box || !naissance || !effectif || effectif <= 0) {
      setErreur('Nom, box, date de naissance et effectif sont obligatoires.')
      return
    }
    if (naissance > aujourdhui()) {
      setErreur('Date de naissance dans le futur.')
      return
    }
    await enregistrer('bandes', { nom: nom.trim(), box, date_naissance: naissance, effectif_initial: effectif, ouvrier_id: ouvrierDuBox(boxes, box), date_reforme: null })
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
      {erreur && <div className="erreur">{erreur}</div>}
      <button className="principal" onClick={creer}>Créer la bande</button>
    </div>
  )
}

/** Liste des boxes : la bande qui l'occupe, l'ouvrier qui s'en occupe, et l'ajout d'un box. */
function BoxesEtOuvriers({ boxes, actives }: { boxes: BoxFerme[]; actives: Bande[] }) {
  const { ouvriers, enregistrer } = useDonnees()
  const sauver = (liste: BoxFerme[]) => enregistrer('reglages', { id: 1, boxes: liste })
  const dernier = boxes[boxes.length - 1]
  const dernierLibre = boxes.length > 1 && !actives.some((b) => b.box === dernier.numero)
  return (
    <section aria-label="Boxes et ouvriers" className="carte">
      <h2 style={{ marginTop: 0 }}>Boxes et ouvriers</h2>
      {boxes.map((x) => {
        const bande = actives.find((b) => b.box === x.numero)
        return (
          <label key={x.numero} className="ligne" style={{ marginBottom: 0 }}>
            <span style={{ color: 'var(--texte)' }}>Box {x.numero} <span className="discret">{bande ? `· ${bande.nom}` : '· libre'}</span></span>
            <select style={{ width: '52%', marginTop: 0 }} value={x.ouvrier_id ?? ''}
              onChange={(e) => sauver(boxes.map((y) => (y.numero === x.numero ? { ...y, ouvrier_id: e.target.value || null } : y)))}>
              <option value="">Sans ouvrier</option>
              {ouvriers.filter((o) => !o.supprime_le && (o.actif || o.id === x.ouvrier_id)).map((o) => <option key={o.id} value={o.id}>{o.nom}</option>)}
            </select>
          </label>
        )
      })}
      <div className={dernierLibre ? 'grille2' : ''} style={{ marginTop: 8 }}>
        <button style={{ width: '100%' }} onClick={() => sauver([...boxes, { numero: (dernier?.numero ?? 0) + 1, ouvrier_id: null }])}>Ajouter un box</button>
        {dernierLibre && <button onClick={() => sauver(boxes.slice(0, -1))}>Retirer le box {dernier.numero}</button>}
      </div>
    </section>
  )
}

export function Bandes() {
  const { bandes, reglages } = useDonnees()
  const [creation, setCreation] = useState(false)
  const visibles = bandes.filter((b) => !b.supprime_le)
  const actives = visibles.filter((b) => !b.date_reforme).sort((a, b) => a.box - b.box)
  const reformees = visibles.filter((b) => b.date_reforme).sort((a, b) => a.nom.localeCompare(b.nom))
  const boxes = boxesFerme(reglages[0], bandes)
  const libres = boxes.map((x) => x.numero).filter((n) => !actives.some((b) => b.box === n))
  return (
    <main>
      <Titre genre="bande">Bandes</Titre>
      {actives.map((b) => <LigneBande key={b.id} b={b} />)}
      <button onClick={() => setCreation((c) => !c)} style={{ width: '100%', marginBottom: 10 }}>Nouvelle bande</button>
      {creation && <NouvelleBande libres={libres} boxes={boxes} onFini={() => setCreation(false)} />}
      <BoxesEtOuvriers boxes={boxes} actives={actives} />
      {reformees.length > 0 && (
        <section aria-label="Bandes réformées">
          <h2>Bandes réformées</h2>
          {reformees.map((b) => <LigneBande key={b.id} b={b} />)}
        </section>
      )}
    </main>
  )
}
