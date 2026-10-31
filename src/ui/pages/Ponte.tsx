import { useState } from 'react'
import { useDonnees } from '../../data/useDonnees'
import { ageSemaines, bandesEnProduction, effectifPresent } from '../../lib/calculs/bandes'
import { couleurTaux } from '../../lib/calculs/couleur'
import { oeufsEnPlaques, plaquesEnOeufs, tauxAttendu, tauxPonte } from '../../lib/calculs/ponte'
import { aujourdhui, formatDate } from '../../lib/format'
import type { Bande, Ponte as TPonte } from '../../lib/types'
import { ChampMontant, Confirmation } from '../composants/communs'

type Saisie = { id?: string; plaques: number | null; restants: number | null; perdus: number | null; morts: number | null; aliment: number | null; observation: string }

const estVide = (s: Saisie) => [s.plaques, s.restants, s.perdus, s.morts, s.aliment].every((v) => v == null) && !s.observation.trim()
const oeufs = (s: Saisie) => plaquesEnOeufs(s.plaques ?? 0, s.restants ?? 0)

function depuisPonte(p?: TPonte): Saisie {
  if (!p) return { plaques: null, restants: null, perdus: null, morts: null, aliment: null, observation: '' }
  const { plaques, restants } = oeufsEnPlaques(p.oeufs_collectes)
  return { id: p.id, plaques, restants, perdus: p.oeufs_perdus, morts: p.mortalite, aliment: p.aliment_kg, observation: p.observation ?? '' }
}

function CartePonte({ bande, effectif, attendu, semaines, saisie, onChange }: {
  bande: Bande; effectif: number; attendu: number; semaines: number; saisie: Saisie; onChange: (s: Saisie) => void
}) {
  const maj = (p: Partial<Saisie>) => onChange({ ...saisie, ...p })
  const n = oeufs(saisie)
  const taux = tauxPonte(n, effectif)
  return (
    <div className="carte" role="group" aria-label={bande.nom}>
      <div className="ligne" style={{ padding: 0 }}>
        <strong>{bande.nom} · box {bande.box}</strong>
        {!estVide(saisie) && <span data-testid="taux" className={couleurTaux(taux, attendu)} style={{ fontWeight: 600 }}>{Math.round(taux * 100)} %</span>}
      </div>
      <div className="discret" style={{ marginBottom: 6 }}>
        {effectif} poules · {semaines} sem. · attendu {Math.round(attendu * 100)} %
      </div>
      <div className="grille2">
        <ChampMontant libelle="Plaques" valeur={saisie.plaques} onChange={(v) => maj({ plaques: v })} />
        <ChampMontant libelle="+ œufs" valeur={saisie.restants} onChange={(v) => maj({ restants: v })} />
      </div>
      <div className="grille3">
        <ChampMontant libelle="Perdus" valeur={saisie.perdus} onChange={(v) => maj({ perdus: v })} />
        <ChampMontant libelle="Morts" valeur={saisie.morts} onChange={(v) => maj({ morts: v })} />
        <ChampMontant libelle="Aliment (kg)" valeur={saisie.aliment} onChange={(v) => maj({ aliment: v })} />
      </div>
      {n > 0 && <div className="discret">Total : {n} œufs</div>}
    </div>
  )
}

function SaisieDuJour({ date }: { date: string }) {
  const { bandes, ponte, reglages, enregistrer } = useDonnees()
  const courbe = reglages[0]?.courbe_attendue ?? undefined
  const enProd = bandesEnProduction(bandes, ponte, date)
  // Seules les cartes modifiées ici sont gardées en état ; les autres suivent les données (y compris celles qui arrivent après l'ouverture).
  const [modifiees, setModifiees] = useState<Record<string, Saisie>>({})
  const [aConfirmer, setAConfirmer] = useState<string[] | null>(null)
  const [fait, setFait] = useState(false)
  const [enCours, setEnCours] = useState(false)

  const existante = (bandeId: string) => ponte.find((p) => p.bande_id === bandeId && p.date === date && !p.supprime_le)
  const saisieDe = (bandeId: string) => modifiees[bandeId] ?? depuisPonte(existante(bandeId))
  const saisies = Object.fromEntries(enProd.map((b) => [b.id, saisieDe(b.id)]))
  const aEnregistrer = enProd.filter((b) => modifiees[b.id] && !estVide(modifiees[b.id]))

  async function valider(forcer = false) {
    if (enCours) return
    const tropDOeufs = aEnregistrer.filter((b) => oeufs(saisies[b.id]) > effectifPresent(b, ponte, date)).map((b) => b.nom)
    if (!forcer && tropDOeufs.length > 0) {
      setAConfirmer(tropDOeufs)
      return
    }
    setAConfirmer(null)
    setEnCours(true)
    try {
      for (const b of aEnregistrer) {
        const s = saisies[b.id]
        // Même ligne pour une bande et un jour : on réutilise l'id déjà connu (ici ou venu de l'autre téléphone).
        const id = s.id ?? existante(b.id)?.id ?? crypto.randomUUID()
        await enregistrer('ponte', {
          id, date, bande_id: b.id, oeufs_collectes: oeufs(s), oeufs_perdus: s.perdus ?? 0,
          mortalite: s.morts ?? 0, aliment_kg: s.aliment, observation: s.observation.trim() || null,
        })
        setModifiees((x) => ({ ...x, [b.id]: { ...x[b.id], id } }))
      }
      setFait(true)
    } finally {
      setEnCours(false)
    }
  }

  if (enProd.length === 0) return <p className="discret">Aucune bande en production à cette date.</p>

  const total = aEnregistrer.reduce((s, b) => s + oeufs(saisies[b.id]), 0)

  return (
    <>
      {enProd.map((b) => (
        <CartePonte
          key={b.id}
          bande={b}
          effectif={effectifPresent(b, ponte, date)}
          semaines={ageSemaines(b, date)}
          attendu={tauxAttendu(ageSemaines(b, date), courbe)}
          saisie={saisies[b.id]}
          onChange={(s) => { setModifiees((x) => ({ ...x, [b.id]: s })); setFait(false) }}
        />
      ))}
      {total > 0 && <p className="discret">Ferme : {oeufsEnPlaques(total).plaques} plaques et {oeufsEnPlaques(total).restants} œufs</p>}
      {fait && <p className="ok">Enregistré ✓ ({formatDate(date)})</p>}
      <button className="principal" disabled={enCours} onClick={() => valider()}>{enCours ? 'Enregistrement…' : 'Enregistrer tout'}</button>
      {aConfirmer && (
        <Confirmation
          message={`Plus d’œufs que de poules pour ${aConfirmer.join(', ')}. Vérifiez les chiffres.`}
          oui="Enregistrer quand même"
          onOui={() => valider(true)}
          onNon={() => setAConfirmer(null)}
        />
      )}
    </>
  )
}

export function Ponte() {
  const [date, setDate] = useState(aujourdhui())
  return (
    <main>
      <h1>Ponte du {formatDate(date)}</h1>
      <label>
        Date
        <input type="date" value={date} max={aujourdhui()} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </label>
      <SaisieDuJour key={date} date={date} />
    </main>
  )
}
