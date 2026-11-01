import { useState } from 'react'
import { useDonnees } from '../../data/useDonnees'
import { ageSemaines, bandesEnProduction, effectifPresent, estVerifiee } from '../../lib/calculs/bandes'
import { boxesFerme, ouvrierDuBox } from '../../lib/calculs/boxes'
import { fiabiliteEffectif } from '../../lib/calculs/effectifs'
import { KG_PAR_SAC } from '../../lib/calculs/aliment'
import { CONDITIONNEMENTS_DEFAUT, OEUFS_PAR_PLATEAU, decomposer, enOeufs } from '../../lib/calculs/oeufs'
import { tauxPonte } from '../../lib/calculs/ponte'
import { couleurTendance, moyenneOeufs7 } from '../../lib/calculs/suiviOeufs'
import { ajouterJours, aujourdhui, formatDate } from '../../lib/format'
import type { Bande, Conditionnement, Ponte as TPonte } from '../../lib/types'
import { useBrouillon } from '../useBrouillon'
import { vibrer } from '../composants/animations'
import { ChampMontant, Confirmation } from '../composants/communs'
import { Recapitulatif, Reussite } from '../composants/Recapitulatif'
import { IconArrowRight } from '@tabler/icons-react'
import { EtatVide, IconeBouton, Titre } from '../composants/Pastille'
import { teinteBande } from '../bandes'

/** Saisie d'une carte : nombre d'œufs gardé tel quel, affiché en lots du conditionnement choisi. */
type Saisie = {
  id?: string; oeufs: number | null; perdus: number | null; morts: number | null; aliment: number | null; observation: string
  /** Date de la saisie d'où vient l'aliment proposé, tant que l'utilisateur ne l'a pas changé. */
  alimentRepris?: string | null
}

// L'aliment simplement repris de la veille ne suffit pas à « commencer » une carte : rien n'est enregistré sans ponte.
const estVide = (s: Saisie) => [s.oeufs, s.perdus, s.morts, s.alimentRepris ? null : s.aliment].every((v) => v == null) && !s.observation.trim()

/**
 * Dernière quantité d'aliment notée pour la bande avant `date` ; à défaut, celle du même box
 * (une nouvelle bande reprend ce que mangeait la précédente).
 */
export function dernierAliment(b: Bande, bandes: Bande[], pontes: TPonte[], date: string): { kg: number; date: string } | null {
  const avant = (ids: string[]) => pontes
    .filter((p) => ids.includes(p.bande_id) && !p.supprime_le && p.aliment_kg != null && p.date < date)
    .sort((x, y) => y.date.localeCompare(x.date))[0]
  const p = avant([b.id]) ?? avant(bandes.filter((x) => x.box === b.box && x.id !== b.id).map((x) => x.id))
  return p ? { kg: p.aliment_kg!, date: p.date } : null
}

const PLURIELS: Record<string, string> = { Plateau: 'Plateaux', Carton: 'Cartons', Boîte: 'Boîtes' }
export function pluriel(nom: string): string {
  const [premier, ...reste] = nom.split(' ')
  return PLURIELS[premier] ? [PLURIELS[premier], ...reste].join(' ') : nom
}

function depuisPonte(p?: TPonte): Saisie {
  if (!p) return { oeufs: null, perdus: null, morts: null, aliment: null, observation: '' }
  return { id: p.id, oeufs: p.oeufs_collectes, perdus: p.oeufs_perdus, morts: p.mortalite, aliment: p.aliment_kg, observation: p.observation ?? '' }
}

/** « Hier : 54 plateaux · Aujourd'hui : 56 plateaux (+2) », coloré selon la variation. */
function HierAujourdhui({ hier, aujourdhui: auj, seuilBaisse, testId }: { hier: number | null; aujourdhui: number; seuilBaisse?: number; testId?: string }) {
  const p = (n: number) => decomposer(n, OEUFS_PAR_PLATEAU)
  const texte = (n: number) => `${p(n).lots} plateau${p(n).lots > 1 ? 'x' : ''}${p(n).restants ? ` + ${p(n).restants}` : ''}`
  const diff = hier != null ? p(auj).lots - p(hier).lots : null
  const classe = hier ? couleurTendance((auj - hier) / hier, seuilBaisse) : ''
  return (
    <div data-testid={testId} className="hier-auj">
      <span>Hier : <strong>{hier == null ? 'non saisi' : texte(hier)}</strong></span>
      <span>Aujourd’hui : <strong>{texte(auj)}</strong>
        {diff != null && <span className={classe}> ({diff > 0 ? '+' : ''}{diff})</span>}
      </span>
    </div>
  )
}

function CartePonte({ bande, effectif, verifie, estime, ouvrier, moyenne, semaines, saisie, cond, seuilBaisse, kgSac, hier, onChange }: {
  bande: Bande; effectif: number; verifie: boolean; estime: number | null; ouvrier?: string; moyenne: number | null; semaines: number
  saisie: Saisie; cond: Conditionnement; seuilBaisse?: number; kgSac: number; hier: number | null; onChange: (s: Saisie) => void
}) {
  const maj = (p: Partial<Saisie>) => onChange({ ...saisie, ...p })
  const n = saisie.oeufs ?? 0
  const { lots, restants } = decomposer(n, cond.oeufs)
  const vide = saisie.oeufs == null
  const taux = tauxPonte(n, effectif)
  // Bande jamais comptée et plus d'œufs que de poules notées : le taux n'a pas de sens, c'est l'effectif qui est faux.
  const effectifDouteux = !verifie && (n > effectif || (estime != null && Math.abs(estime - effectif) / estime > 0.3))
  const ecart = moyenne ? (n - moyenne) / moyenne : null
  const classe = ecart == null ? 'ok' : couleurTendance(ecart, seuilBaisse)
  const plateaux = decomposer(n, OEUFS_PAR_PLATEAU)
  const changerLots = (v: number | null) => maj({ oeufs: v == null && restants === 0 ? null : enOeufs(v ?? 0, cond.oeufs, vide ? 0 : restants) })
  const changerRestants = (v: number | null) => maj({ oeufs: v == null && lots === 0 ? null : enOeufs(vide ? 0 : lots, cond.oeufs, v ?? 0) })
  return (
    <div className="carte bordure-bande" role="group" aria-label={bande.nom} style={{ borderLeftColor: teinteBande(bande) }}>
      <div className="ligne" style={{ padding: 0, alignItems: 'baseline' }}>
        <strong style={{ fontSize: 17 }}>{bande.nom} <span className="discret">· box {bande.box}{ouvrier ? ` · ${ouvrier}` : ''}</span></strong>
        {!vide && <span data-testid="oeufs" style={{ fontWeight: 800, fontSize: 20 }}>{n} œufs</span>}
      </div>
      <div className="discret" style={{ marginBottom: 6 }}>
        {semaines} sem.{moyenne != null && ` · moyenne 7 j : ${Math.round(moyenne)} œufs`}
        {!vide && ` · ${plateaux.lots} plateaux${plateaux.restants ? ` + ${plateaux.restants}` : ''}`}
      </div>
      {!vide && <HierAujourdhui hier={hier} aujourdhui={n} seuilBaisse={seuilBaisse} testId="hier-auj" />}
      {!vide && ecart != null && (
        <div data-testid="tendance" className={classe} style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
          {ecart >= 0 ? '▲' : '▼'} {Math.abs(Math.round(ecart * 100))} % par rapport à sa moyenne de 7 jours ({Math.round(moyenne!)})
        </div>
      )}
      {!vide && (effectifDouteux
        ? <div data-testid="taux" className="du" style={{ marginBottom: 8, fontSize: 13, fontWeight: 700 }}>effectif à vérifier{estime != null ? ` (≈ ${estime} poules d’après la ponte)` : ''}</div>
        : <div data-testid="taux" className="discret" style={{ marginBottom: 8 }}>taux estimé {Math.round(taux * 100)} % (≈ {effectif} poules{verifie ? '' : ', à vérifier'})</div>)}
      <div className={cond.oeufs > 1 ? 'grille2' : ''}>
        <ChampMontant libelle={cond.oeufs > 1 ? pluriel(cond.nom) : 'Œufs'} valeur={vide ? null : lots} onChange={changerLots} />
        {cond.oeufs > 1 && <ChampMontant libelle="+ œufs" valeur={vide ? null : restants} onChange={changerRestants} />}
      </div>
      <div className="grille2">
        <ChampMontant libelle="Perdus" valeur={saisie.perdus} onChange={(v) => maj({ perdus: v })} />
        <ChampMontant libelle="Morts (facultatif)" valeur={saisie.morts} onChange={(v) => maj({ morts: v })} />
      </div>
      <div className="champ-aliment">
        <button type="button" aria-label={`${bande.nom} : 1 sac de moins`} disabled={(saisie.aliment ?? 0) < kgSac}
          onClick={() => maj({ aliment: Math.max(0, (saisie.aliment ?? 0) - kgSac), alimentRepris: null })}>− 1 sac</button>
        <ChampMontant libelle="Aliment (kg)" valeur={saisie.aliment} onChange={(v) => maj({ aliment: v, alimentRepris: null })} />
        <button type="button" aria-label={`${bande.nom} : 1 sac de plus`}
          onClick={() => maj({ aliment: (saisie.aliment ?? 0) + kgSac, alimentRepris: null })}>+ 1 sac</button>
      </div>
      {saisie.aliment != null && (
        <div className="discret" style={{ marginTop: -6, marginBottom: 6 }}>
          = {(saisie.aliment / kgSac).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} sac{saisie.aliment / kgSac > 1 ? 's' : ''} de {kgSac} kg
          {saisie.alimentRepris && <span className="repris"> · comme le {formatDate(saisie.alimentRepris).slice(0, 5)}</span>}
        </div>
      )}
      {n > 0 && <div className="discret">Total : {n} œufs</div>}
    </div>
  )
}

function SaisieDuJour({ date, cond }: { date: string; cond: Conditionnement }) {
  const { bandes, ponte, recensements, mortalites, reglages, ouvriers, enregistrer } = useDonnees()
  const boxes = boxesFerme(reglages[0], bandes)
  const enProd = bandesEnProduction(bandes, ponte, date)
  // Seules les cartes modifiées ici sont gardées en état ; les autres suivent les données (y compris celles qui arrivent après l'ouverture).
  // Brouillon par jour : changer d'onglet, de date ou recevoir un appel ne fait pas perdre ce qui a été tapé.
  const [modifiees, setModifiees, oublierBrouillon] = useBrouillon<Record<string, Saisie>>(`brouillon-ponte-${date}`, () => ({}))
  const [aConfirmer, setAConfirmer] = useState<string[] | null>(null)
  const [etape, setEtape] = useState<'cartes' | 'recap' | 'fait'>('cartes')
  const [record, setRecord] = useState(false)
  const [bilan, setBilan] = useState(0)
  const [enCours, setEnCours] = useState(false)

  const existante = (bandeId: string) => ponte.find((p) => p.bande_id === bandeId && p.date === date && !p.supprime_le)
  const kgSac = reglages[0]?.aliment?.kg_par_sac || KG_PAR_SAC
  /** Jour pas encore saisi : l'aliment reprend la dernière quantité notée, sauf modification. */
  function saisieDe(b: Bande): Saisie {
    if (modifiees[b.id]) return modifiees[b.id]
    const p = existante(b.id)
    if (p) return depuisPonte(p)
    const dernier = dernierAliment(b, bandes, ponte, date)
    return { ...depuisPonte(), aliment: dernier?.kg ?? null, alimentRepris: dernier?.date ?? null }
  }
  const aEnregistrer = enProd.filter((b) => modifiees[b.id] && !estVide(modifiees[b.id]))
  const totalJour = enProd.reduce((s, b) => s + (saisieDe(b).oeufs ?? 0), 0)
  const totalHier = ponte.filter((p) => p.date === ajouterJours(date, -1) && !p.supprime_le).reduce((s, p) => s + p.oeufs_collectes, 0)

  function continuer(forcer = false) {
    // Seulement pour les bandes comptées : ailleurs, c'est l'effectif noté qui est douteux, pas la saisie.
    const tropDOeufs = aEnregistrer
      .filter((b) => estVerifiee(b, recensements) && (modifiees[b.id].oeufs ?? 0) > effectifPresent(b, ponte, date, recensements, mortalites))
      .map((b) => b.nom)
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
      setBilan(totalJour)
      oublierBrouillon()
      vibrer()
      setEtape('fait')
    } finally {
      setEnCours(false)
    }
  }

  if (enProd.length === 0) return <EtatVide genre="bande" message="Aucune bande en production à cette date." />

  if (etape === 'fait') {
    const { lots, restants } = decomposer(bilan, OEUFS_PAR_PLATEAU)
    return (
      <Reussite
        message="Ponte enregistrée"
        detail={`${record ? 'Record de la semaine ! ' : ''}${bilan} œufs, soit ${lots} plateaux${restants ? ` et ${restants} œufs` : ''}.`}
        action="Retour à l’accueil"
        onAction={() => { window.location.hash = '#/' }}
      />
    )
  }

  if (etape === 'recap')
    return (
      <Recapitulatif
        titre={`Ponte du ${formatDate(date)}`}
        lignes={aEnregistrer.map((b) => {
          const s = modifiees[b.id]
          const taux = Math.round(tauxPonte(s.oeufs ?? 0, effectifPresent(b, ponte, date, recensements, mortalites)) * 100)
          const pl = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`
          const extra = [s.perdus ? pl(s.perdus, 'perdu') : '', s.morts ? pl(s.morts, 'mort') : '', s.aliment != null ? `${s.aliment} kg` : ''].filter(Boolean).join(' · ')
          const { lots, restants } = decomposer(s.oeufs ?? 0, OEUFS_PAR_PLATEAU)
          return [`${b.nom}`, `${s.oeufs ?? 0} œufs (${lots} plateaux${restants ? ` + ${restants}` : ''}) · ${!estVerifiee(b, recensements) && taux > 100 ? 'effectif à vérifier' : `taux estimé ${taux} %`}${extra ? ` · ${extra}` : ''}`] as [string, string]
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
          effectif={effectifPresent(b, ponte, date, recensements, mortalites)}
          verifie={estVerifiee(b, recensements)}
          estime={fiabiliteEffectif(b, { pontes: ponte, recensements, mortalites }, date, reglages[0]?.courbe_attendue).estime}
          ouvrier={ouvriers.find((o) => o.id === ouvrierDuBox(boxes, b.box))?.nom}
          semaines={ageSemaines(b, date)}
          moyenne={moyenneOeufs7(b.id, ponte, date)}
          seuilBaisse={reglages[0]?.seuils?.baisse_pct}
          saisie={saisieDe(b)}
          kgSac={kgSac}
          hier={ponte.find((p) => p.bande_id === b.id && p.date === ajouterJours(date, -1) && !p.supprime_le)?.oeufs_collectes ?? null}
          onChange={(s) => setModifiees((x) => ({ ...x, [b.id]: s }))}
        />
      ))}
      {totalJour > 0 && (
        <div className="carte" aria-label="Ferme">
          <strong>Ferme</strong>
          <HierAujourdhui hier={totalHier || null} aujourdhui={totalJour} seuilBaisse={reglages[0]?.seuils?.baisse_pct} testId="hier-auj-ferme" />
        </div>
      )}
      <button className="principal" disabled={aEnregistrer.length === 0} onClick={() => continuer()}>Continuer<IconeBouton Icone={IconArrowRight} /></button>
      {aEnregistrer.length === 0 && <p className="discret" style={{ textAlign: 'center' }}>Saisissez les œufs d’au moins une bande pour continuer.</p>}
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
  // « Corriger » une ponte refusée ouvre ce jour-là (#/ponte?date=AAAA-MM-JJ).
  const [date, setDate] = useState(() => {
    const d = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('date')
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= aujourdhui() ? d : aujourdhui()
  })
  const [taille, setTaille] = useState(OEUFS_PAR_PLATEAU)
  const cond = conditionnements.find((c) => c.oeufs === taille) ?? conditionnements[0]
  return (
    <main>
      <Titre genre="ponte">Ponte du {formatDate(date)}</Titre>
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
