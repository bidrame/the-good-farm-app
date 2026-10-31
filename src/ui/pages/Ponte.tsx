import { useState } from 'react'
import { useDonnees } from '../../data/useDonnees'
import { ageSemaines, bandesEnProduction, effectifPresent } from '../../lib/calculs/bandes'
import { CONDITIONNEMENTS_DEFAUT, OEUFS_PAR_PLATEAU, decomposer, enOeufs } from '../../lib/calculs/oeufs'
import { tauxPonte } from '../../lib/calculs/ponte'
import { couleurTendance, moyenneOeufs7 } from '../../lib/calculs/suiviOeufs'
import { ajouterJours, aujourdhui, formatDate } from '../../lib/format'
import type { Bande, Conditionnement, Ponte as TPonte } from '../../lib/types'
import { vibrer } from '../composants/animations'
import { ChampMontant, Confirmation } from '../composants/communs'
import { Recapitulatif, Reussite } from '../composants/Recapitulatif'

/** Saisie d'une carte : nombre d'œufs gardé tel quel, affiché en lots du conditionnement choisi. */
type Saisie = { id?: string; oeufs: number | null; perdus: number | null; morts: number | null; aliment: number | null; observation: string }

const estVide = (s: Saisie) => [s.oeufs, s.perdus, s.morts, s.aliment].every((v) => v == null) && !s.observation.trim()

const PLURIELS: Record<string, string> = { Plateau: 'Plateaux', Carton: 'Cartons', Boîte: 'Boîtes' }
export function pluriel(nom: string): string {
  const [premier, ...reste] = nom.split(' ')
  return PLURIELS[premier] ? [PLURIELS[premier], ...reste].join(' ') : nom
}

function depuisPonte(p?: TPonte): Saisie {
  if (!p) return { oeufs: null, perdus: null, morts: null, aliment: null, observation: '' }
  return { id: p.id, oeufs: p.oeufs_collectes, perdus: p.oeufs_perdus, morts: p.mortalite, aliment: p.aliment_kg, observation: p.observation ?? '' }
}

function CartePonte({ bande, effectif, moyenne, semaines, saisie, cond, seuilBaisse, onChange }: {
  bande: Bande; effectif: number; moyenne: number | null; semaines: number; saisie: Saisie; cond: Conditionnement; seuilBaisse?: number; onChange: (s: Saisie) => void
}) {
  const maj = (p: Partial<Saisie>) => onChange({ ...saisie, ...p })
  const n = saisie.oeufs ?? 0
  const { lots, restants } = decomposer(n, cond.oeufs)
  const vide = saisie.oeufs == null
  const taux = tauxPonte(n, effectif)
  const ecart = moyenne ? (n - moyenne) / moyenne : null
  const classe = ecart == null ? 'ok' : couleurTendance(ecart, seuilBaisse)
  const plateaux = decomposer(n, OEUFS_PAR_PLATEAU)
  const changerLots = (v: number | null) => maj({ oeufs: v == null && restants === 0 ? null : enOeufs(v ?? 0, cond.oeufs, vide ? 0 : restants) })
  const changerRestants = (v: number | null) => maj({ oeufs: v == null && lots === 0 ? null : enOeufs(vide ? 0 : lots, cond.oeufs, v ?? 0) })
  return (
    <div className="carte" role="group" aria-label={bande.nom}>
      <div className="ligne" style={{ padding: 0, alignItems: 'baseline' }}>
        <strong style={{ fontSize: 17 }}>{bande.nom} <span className="discret">· box {bande.box}</span></strong>
        {!vide && <span data-testid="oeufs" style={{ fontWeight: 800, fontSize: 20 }}>{n} œufs</span>}
      </div>
      <div className="discret" style={{ marginBottom: 6 }}>
        {semaines} sem.{moyenne != null && ` · moyenne 7 j : ${Math.round(moyenne)} œufs`}
        {!vide && ` · ${plateaux.lots} plateaux${plateaux.restants ? ` + ${plateaux.restants}` : ''}`}
      </div>
      {!vide && ecart != null && (
        <div data-testid="tendance" className={classe} style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
          {ecart >= 0 ? '▲' : '▼'} {Math.abs(Math.round(ecart * 100))} % par rapport à sa moyenne de 7 jours ({Math.round(moyenne!)})
        </div>
      )}
      {!vide && <div data-testid="taux" className="discret" style={{ marginBottom: 8 }}>taux estimé {Math.round(taux * 100)} % (≈ {effectif} poules)</div>}
      <div className={cond.oeufs > 1 ? 'grille2' : ''}>
        <ChampMontant libelle={cond.oeufs > 1 ? pluriel(cond.nom) : 'Œufs'} valeur={vide ? null : lots} onChange={changerLots} />
        {cond.oeufs > 1 && <ChampMontant libelle="+ œufs" valeur={vide ? null : restants} onChange={changerRestants} />}
      </div>
      <div className="grille3">
        <ChampMontant libelle="Perdus" valeur={saisie.perdus} onChange={(v) => maj({ perdus: v })} />
        <ChampMontant libelle="Morts (facultatif)" valeur={saisie.morts} onChange={(v) => maj({ morts: v })} />
        <ChampMontant libelle="Aliment (kg)" valeur={saisie.aliment} onChange={(v) => maj({ aliment: v })} />
      </div>
      {n > 0 && <div className="discret">Total : {n} œufs</div>}
    </div>
  )
}

function SaisieDuJour({ date, cond }: { date: string; cond: Conditionnement }) {
  const { bandes, ponte, recensements, reglages, enregistrer } = useDonnees()
  const enProd = bandesEnProduction(bandes, ponte, date)
  // Seules les cartes modifiées ici sont gardées en état ; les autres suivent les données (y compris celles qui arrivent après l'ouverture).
  const [modifiees, setModifiees] = useState<Record<string, Saisie>>({})
  const [aConfirmer, setAConfirmer] = useState<string[] | null>(null)
  const [etape, setEtape] = useState<'cartes' | 'recap' | 'fait'>('cartes')
  const [record, setRecord] = useState(false)
  const [enCours, setEnCours] = useState(false)

  const existante = (bandeId: string) => ponte.find((p) => p.bande_id === bandeId && p.date === date && !p.supprime_le)
  const saisieDe = (bandeId: string) => modifiees[bandeId] ?? depuisPonte(existante(bandeId))
  const aEnregistrer = enProd.filter((b) => modifiees[b.id] && !estVide(modifiees[b.id]))
  const totalJour = enProd.reduce((s, b) => s + (saisieDe(b.id).oeufs ?? 0), 0)

  function continuer(forcer = false) {
    const tropDOeufs = aEnregistrer.filter((b) => (modifiees[b.id].oeufs ?? 0) > effectifPresent(b, ponte, date, recensements)).map((b) => b.nom)
    if (!forcer && tropDOeufs.length > 0) return setAConfirmer(tropDOeufs)
    setAConfirmer(null)
    if (aEnregistrer.length > 0) setEtape('recap')
  }

  /** Record : plus d'œufs que chacun des 7 jours précédents (au moins un jour connu). */
  function estRecord(): boolean {
    const precedents = Array.from({ length: 7 }, (_, i) => ajouterJours(date, -1 - i))
      .map((d) => ponte.filter((p) => p.date === d && !p.supprime_le).reduce((s, p) => s + p.oeufs_collectes, 0))
      .filter((n) => n > 0)
    return precedents.length > 0 && totalJour > Math.max(...precedents)
  }

  async function valider() {
    if (enCours) return
    setEnCours(true)
    try {
      for (const b of aEnregistrer) {
        const s = modifiees[b.id]
        // Même ligne pour une bande et un jour : on réutilise l'id déjà connu (ici ou venu de l'autre téléphone).
        const id = s.id ?? existante(b.id)?.id ?? crypto.randomUUID()
        await enregistrer('ponte', {
          id, date, bande_id: b.id, oeufs_collectes: s.oeufs ?? 0, oeufs_perdus: s.perdus ?? 0,
          mortalite: s.morts ?? 0, aliment_kg: s.aliment, observation: s.observation.trim() || null,
        })
        setModifiees((x) => ({ ...x, [b.id]: { ...x[b.id], id } }))
      }
      setRecord(estRecord())
      vibrer()
      setEtape('fait')
    } finally {
      setEnCours(false)
    }
  }

  if (enProd.length === 0) return <p className="discret">Aucune bande en production à cette date.</p>

  if (etape === 'fait') {
    const { lots, restants } = decomposer(totalJour, OEUFS_PAR_PLATEAU)
    return (
      <Reussite
        message="Ponte enregistrée"
        detail={`${record ? 'Record de la semaine ! ' : ''}${totalJour} œufs, soit ${lots} plateaux${restants ? ` et ${restants} œufs` : ''}.`}
        action="Corriger"
        onAction={() => setEtape('cartes')}
      />
    )
  }

  if (etape === 'recap')
    return (
      <Recapitulatif
        titre={`Ponte du ${formatDate(date)}`}
        lignes={aEnregistrer.map((b) => {
          const s = modifiees[b.id]
          const taux = Math.round(tauxPonte(s.oeufs ?? 0, effectifPresent(b, ponte, date, recensements)) * 100)
          const pl = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`
          const extra = [s.perdus ? pl(s.perdus, 'perdu') : '', s.morts ? pl(s.morts, 'mort') : '', s.aliment != null ? `${s.aliment} kg` : ''].filter(Boolean).join(' · ')
          const { lots, restants } = decomposer(s.oeufs ?? 0, OEUFS_PAR_PLATEAU)
          return [`${b.nom}`, `${s.oeufs ?? 0} œufs (${lots} plateaux${restants ? ` + ${restants}` : ''}) · taux estimé ${taux} %${extra ? ` · ${extra}` : ''}`] as [string, string]
        })}
        total={['Ferme', `${totalJour} œufs`]}
        onModifier={() => setEtape('cartes')}
        onValider={valider}
        enCours={enCours}
      />
    )

  return (
    <>
      {enProd.map((b) => (
        <CartePonte
          key={b.id}
          bande={b}
          cond={cond}
          effectif={effectifPresent(b, ponte, date, recensements)}
          semaines={ageSemaines(b, date)}
          moyenne={moyenneOeufs7(b.id, ponte, date)}
          seuilBaisse={reglages[0]?.seuils?.baisse_pct}
          saisie={saisieDe(b.id)}
          onChange={(s) => setModifiees((x) => ({ ...x, [b.id]: s }))}
        />
      ))}
      {totalJour > 0 && <p className="discret">Ferme : {decomposer(totalJour, OEUFS_PAR_PLATEAU).lots} plateaux et {decomposer(totalJour, OEUFS_PAR_PLATEAU).restants} œufs</p>}
      <button className="principal" onClick={() => continuer()}>Continuer</button>
      {aConfirmer && (
        <Confirmation
          message={`Plus d’œufs que de poules pour ${aConfirmer.join(', ')}. Vérifiez les chiffres.`}
          oui="Continuer quand même"
          onOui={() => continuer(true)}
          onNon={() => setAConfirmer(null)}
        />
      )}
    </>
  )
}

export function Ponte() {
  const { reglages } = useDonnees()
  const conditionnements = reglages[0]?.conditionnements?.length ? reglages[0].conditionnements : CONDITIONNEMENTS_DEFAUT
  const [date, setDate] = useState(aujourdhui())
  const [taille, setTaille] = useState(OEUFS_PAR_PLATEAU)
  const cond = conditionnements.find((c) => c.oeufs === taille) ?? conditionnements[0]
  return (
    <main>
      <h1>Ponte du {formatDate(date)}</h1>
      <div className="grille2">
        <label>
          Date
          <input type="date" value={date} max={aujourdhui()} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <label>
          Compter en
          <select value={cond.oeufs} onChange={(e) => setTaille(Number(e.target.value))}>
            {conditionnements.map((c) => <option key={c.oeufs} value={c.oeufs}>{c.nom}</option>)}
          </select>
        </label>
      </div>
      <SaisieDuJour key={date} date={date} cond={cond} />
    </main>
  )
}
