import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { seDeconnecter } from '../../data/auth'
import { useDonnees } from '../../data/useDonnees'
import { SEUILS_DEFAUT } from '../../lib/calculs/alertes'
import { CONDITIONNEMENTS_DEFAUT, OEUFS_PAR_PLATEAU, enOeufs } from '../../lib/calculs/oeufs'
import { COURBE_DEFAUT } from '../../lib/calculs/ponte'
import { CALIBRES, NOM_CALIBRE } from '../../lib/calculs/calibres'
import { bandesEnProduction } from '../../lib/calculs/bandes'
import { moyenneOeufs7 } from '../../lib/calculs/suiviOeufs'
import { aujourdhui, formatDate } from '../../lib/format'
import { BoxesEtOuvriers } from '../composants/BoxesEtOuvriers'
import { ChampMontant } from '../composants/communs'
import { useAnnuler } from '../composants/Annuler'
import { Reglette } from '../composants/Reglette'
import type { Bande, Calibre, Conditionnement, Ponte, Seuils } from '../../lib/types'
import type { TypeTx, Unite } from '../../lib/types'
import { BoutonAjout, Pastille, Titre } from '../composants/Pastille'
import type { Genre } from '../icones'

const UNITES: [Unite, string][] = [['plaque', 'Plaque de 30'], ['unite', 'Unité'], ['kg', 'Kg'], ['forfait', 'Forfait'], ['autre', 'Autre']]

/** Petit graphique de la courbe : semaines en bas, taux de ponte en hauteur. */
function GraphiqueCourbe({ points }: { points: [number, number][] }) {
  const L = 300, H = 110, m = 18
  const min = points[0]?.[0] ?? 0, max = points[points.length - 1]?.[0] ?? 1
  const x = (sem: number) => m + ((sem - min) / (max - min || 1)) * (L - 2 * m)
  const y = (t: number) => H - m - t * (H - 2 * m)
  const trace = points.map(([sem, t]) => `${x(sem)},${y(t)}`).join(' ')
  const sommet = points.reduce((p, c) => (c[1] > p[1] ? c : p), points[0] ?? [0, 0])
  return (
    <svg viewBox={`0 0 ${L} ${H}`} style={{ width: '100%', height: 'auto' }} role="img"
      aria-label={`Courbe de ponte : sommet ${Math.round(sommet[1] * 100)} % à ${sommet[0]} semaines`}>
      <line x1={m} y1={H - m} x2={L - m} y2={H - m} stroke="var(--bord)" />
      <polyline points={`${x(min)},${H - m} ${trace} ${x(max)},${H - m}`} fill="var(--t-ambre-fond)" stroke="none" />
      <polyline points={trace} fill="none" stroke="var(--vert-vif)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(sommet[0])} cy={y(sommet[1])} r="4" fill="var(--vert-vif)" />
      <text x={x(sommet[0])} y={y(sommet[1]) - 8} textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor">{Math.round(sommet[1] * 100)} %</text>
      <text x={m} y={H - 4} fontSize="10" fill="currentColor" opacity="0.7">{min} sem.</text>
      <text x={L - m} y={H - 4} fontSize="10" textAnchor="end" fill="currentColor" opacity="0.7">{max} sem.</text>
    </svg>
  )
}

function Courbe() {
  const { reglages, enregistrer } = useDonnees()
  const [points, setPoints] = useState<[number, number][]>(() => reglages[0]?.courbe_attendue ?? COURBE_DEFAUT)
  const [fait, setFait] = useState(false)
  return (
    <details className="avance">
      <summary>Avancé : courbe de ponte attendue</summary>
      <p className="discret" style={{ marginTop: 4 }}>Sert à juger le taux de ponte selon l’âge des poules. Les valeurs habituelles conviennent.</p>
      <GraphiqueCourbe points={points} />
      <div className="grille3">
        {points.map(([s, t], i) => (
          <label key={s}>
            {`Taux à ${s} semaines (%)`}
            <input inputMode="numeric" value={Math.round(t * 100)} onChange={(e) => {
              const v = Number(e.target.value.replace(/\D/g, ''))
              setPoints((p) => p.map((x, j) => (j === i ? [s, Math.min(100, v) / 100] : x)))
              setFait(false)
            }} />
          </label>
        ))}
      </div>
      <div className="grille2">
        <button onClick={() => { setPoints(COURBE_DEFAUT); setFait(false) }}>Valeurs habituelles</button>
        <button className="principal" style={{ minHeight: 44, fontSize: 15 }} onClick={async () => {
          await enregistrer('reglages', { id: 1, courbe_attendue: points })
          setFait(true)
        }}>Enregistrer la courbe</button>
      </div>
      {fait && <p className="ok">Enregistré ✓</p>}
    </details>
  )
}

function Produits() {
  const { produits, enregistrer } = useDonnees()
  const [nom, setNom] = useState('')
  const [type, setType] = useState<TypeTx>('vente')
  const [unite, setUnite] = useState<Unite>('unite')
  return (
    <div>
      {produits.filter((p) => !p.supprime_le).sort((a, b) => a.type.localeCompare(b.type) || a.nom.localeCompare(b.nom)).map((p) => (
        <div className="ligne" key={p.id}>
          <span style={{ opacity: p.actif ? 1 : 0.5 }}>{p.nom} <span className="discret">{p.type === 'vente' ? 'vente' : 'dépense'}</span></span>
          <select aria-label={`Unité de ${p.nom}`} value={p.unite} style={{ width: 'auto', minWidth: 110 }} onChange={(e) => enregistrer('produits', { ...p, unite: e.target.value as Unite })}>
            {UNITES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button className="lien" onClick={() => enregistrer('produits', { ...p, actif: !p.actif })}>{p.actif ? 'Désactiver' : 'Réactiver'}</button>
        </div>
      ))}
      <label>Nouveau produit<input value={nom} onChange={(e) => setNom(e.target.value)} /></label>
      <div className="grille2">
        <label>
          Type du produit
          <select value={type} onChange={(e) => setType(e.target.value as TypeTx)}>
            <option value="vente">Vente</option>
            <option value="depense">Dépense</option>
          </select>
        </label>
        <label>
          Unité
          <select value={unite} onChange={(e) => setUnite(e.target.value as Unite)}>
            {UNITES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>
      <BoutonAjout onClick={async () => {
        if (!nom.trim()) return
        await enregistrer('produits', { nom: nom.trim(), type, unite, actif: true })
        setNom('')
      }}>Ajouter le produit</BoutonAjout>
    </div>
  )
}

function Ouvriers() {
  const { ouvriers, enregistrer } = useDonnees()
  const [bandeauAnnuler, proposerAnnuler] = useAnnuler()
  const [nom, setNom] = useState('')
  return (
    <div className="sous-rubrique">
      <h3>Ouvriers</h3>
      {ouvriers.filter((o) => !o.supprime_le && o.actif).map((o) => (
        <div className="ligne" key={o.id}>
          <span>{o.nom}</span>
          <button className="lien" aria-label={`Désactiver ${o.nom}`} onClick={() => {
            enregistrer('ouvriers', { ...o, actif: false })
            proposerAnnuler(`${o.nom} désactivé`, () => enregistrer('ouvriers', { ...o, actif: true }))
          }}>Désactiver</button>
        </div>
      ))}
      <label>Nouvel ouvrier<input value={nom} onChange={(e) => setNom(e.target.value)} /></label>
      <BoutonAjout onClick={async () => {
        if (!nom.trim()) return
        await enregistrer('ouvriers', { nom: nom.trim(), actif: true })
        setNom('')
      }}>Ajouter l’ouvrier</BoutonAjout>
      {bandeauAnnuler}
    </div>
  )
}

/** « 15 % ≈ 11 plateaux de moins par jour » pour la bande qui pond le plus en ce moment. */
function exempleBaisse(pct: number, bandes: Bande[], pontes: Ponte[]): string | null {
  const ref = aujourdhui()
  const moyennes = bandesEnProduction(bandes, pontes, ref)
    .map((b) => ({ b, m: moyenneOeufs7(b.id, pontes, ref) ?? 0 }))
    .sort((x, y) => y.m - x.m)
  const top = moyennes[0]
  if (!top || top.m <= 0) return null
  const plateaux = Math.max(1, Math.round((top.m * pct) / 100 / OEUFS_PAR_PLATEAU))
  return `Pour ${top.b.nom} (≈ ${Math.round(top.m)} œufs par jour), ${pct} % ≈ ${plateaux} plateau${plateaux > 1 ? 'x' : ''} de moins par jour.`
}

function SeuilsAlerte() {
  const { reglages, bandes, ponte, enregistrer } = useDonnees()
  const [s, setS] = useState<Seuils>(() => ({ ...SEUILS_DEFAUT, ...reglages[0]?.seuils }))
  const [fait, setFait] = useState(false)
  const maj = (p: Partial<Seuils>) => { setS((x) => ({ ...x, ...p })); setFait(false) }
  const exemple = exempleBaisse(s.baisse_pct, bandes, ponte)
  return (
    <div className="phrases-alerte">
      <p>
        Prévenez-moi si les œufs d’une bande baissent de plus de{' '}
        <Reglette libelle="Baisse des œufs (%)" valeur={s.baisse_pct} min={5} max={50} onChange={(n) => maj({ baisse_pct: n })} /> %
        {exemple && <span className="discret exemple">{exemple}</span>}
      </p>
      <p>
        Prévenez-moi si je dois à un fournisseur depuis plus de{' '}
        <Reglette libelle="Dette fournisseur (jours)" valeur={s.jours_dette} min={1} max={180} pas={5} onChange={(n) => maj({ jours_dette: n })} /> jours
      </p>
      <p>
        Rappelez-moi d’exporter la sauvegarde tous les{' '}
        <Reglette libelle="Sauvegarde (jours)" valeur={s.jours_sauvegarde} min={1} max={60} onChange={(n) => maj({ jours_sauvegarde: n })} /> jours
      </p>
      <label className="case">
        <input type="checkbox" checked={s.alerte_mortalite} onChange={(e) => maj({ alerte_mortalite: e.target.checked })} />
        <span>Me prévenir aussi en cas de morts <span className="discret">(facultatif : le suivi se fait d’abord sur les œufs du jour)</span></span>
      </label>
      {s.alerte_mortalite && (
        <p>
          …à partir de{' '}
          <Reglette libelle="Mortalité (pour mille par jour)" valeur={s.mortalite_pour_mille} min={1} max={50} onChange={(n) => maj({ mortalite_pour_mille: n })} /> morts pour 1 000 poules en un jour
        </p>
      )}
      <button className="principal" onClick={async () => {
        await enregistrer('reglages', { id: 1, seuils: s })
        setFait(true)
      }}>Enregistrer les alertes</button>
      {fait && <p className="ok">Enregistré ✓</p>}
    </div>
  )
}

function Conditionnements() {
  const { reglages, enregistrer } = useDonnees()
  const liste: Conditionnement[] = reglages[0]?.conditionnements?.length ? reglages[0].conditionnements : CONDITIONNEMENTS_DEFAUT
  const [bandeauAnnuler, proposerAnnuler] = useAnnuler()
  const [nom, setNom] = useState('')
  const [oeufs, setOeufs] = useState<number | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const sauver = (l: Conditionnement[]) => enregistrer('reglages', { id: 1, conditionnements: l })
  return (
    <section className="sous-rubrique" aria-label="Conditionnements des œufs">
      <h3>Conditionnements des œufs</h3>
      {liste.map((c) => (
        <div className="ligne" key={c.oeufs}>
          <span>{c.nom} <span className="discret">· {c.oeufs} œufs</span></span>
          {c.oeufs !== OEUFS_PAR_PLATEAU && (
            <button className="lien" aria-label={`Retirer ${c.nom}`} onClick={() => {
              sauver(liste.filter((x) => x.oeufs !== c.oeufs))
              proposerAnnuler(`${c.nom} retiré`, () => sauver(liste))
            }}>Retirer</button>
          )}
        </div>
      ))}
      <div className="grille2" style={{ marginTop: 8 }}>
        <label>Nom<input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Plateau de 20" /></label>
        <ChampMontant libelle="Œufs" valeur={oeufs} onChange={setOeufs} />
      </div>
      {erreur && <div className="erreur">{erreur}</div>}
      <BoutonAjout onClick={async () => {
        if (!nom.trim() || !oeufs || oeufs <= 0) return setErreur('Nom et nombre d’œufs obligatoires.')
        if (liste.some((c) => c.oeufs === oeufs)) return setErreur('Ce nombre d’œufs existe déjà.')
        setErreur(null)
        await sauver([...liste, { nom: nom.trim(), oeufs }].sort((a, b) => (a.oeufs === OEUFS_PAR_PLATEAU ? -1 : b.oeufs === OEUFS_PAR_PLATEAU ? 1 : b.oeufs - a.oeufs)))
        setNom('')
        setOeufs(null)
      }}>Ajouter</BoutonAjout>
      {bandeauAnnuler}
    </section>
  )
}

function Inventaire() {
  const { reglages, enregistrer } = useDonnees()
  const depart = reglages[0]?.stock_depart
  const [parCalibre, setParCalibre] = useState<Partial<Record<Calibre, number | null>>>({})
  const [plateaux, setPlateaux] = useState<number | null>(null)
  const [restants, setRestants] = useState<number | null>(null)
  const [fait, setFait] = useState(false)
  const tries = Object.fromEntries(CALIBRES.filter((c) => parCalibre[c]).map((c) => [c, parCalibre[c]! * OEUFS_PAR_PLATEAU]))
  const total = Object.values(tries).reduce((s, n) => s + n, 0) + enOeufs(plateaux ?? 0, OEUFS_PAR_PLATEAU, restants ?? 0)
  return (
    <section className="sous-rubrique" aria-label="Inventaire des œufs">
      <h3>Inventaire des œufs</h3>
      <p className="discret" style={{ marginTop: 0 }}>
        Comptez les plateaux au magasin ce soir, par calibre : l’appli suivra ensuite le stock toute seule (ponte de chaque box selon son calibre − ventes).
        {depart && ` Dernier inventaire : ${depart.oeufs} œufs le ${formatDate(depart.date)}.`}
      </p>
      <div className="grille3">
        {CALIBRES.map((c) => (
          <ChampMontant key={c} libelle={NOM_CALIBRE[c]} suffixe="plateaux" valeur={parCalibre[c] ?? null}
            onChange={(v) => { setParCalibre((x) => ({ ...x, [c]: v })); setFait(false) }} />
        ))}
      </div>
      <p className="discret" style={{ margin: '0 0 4px' }}>Œufs non triés (facultatif)</p>
      <div className="grille2">
        <ChampMontant libelle="Plateaux de 30" valeur={plateaux} onChange={(v) => { setPlateaux(v); setFait(false) }} />
        <ChampMontant libelle="+ œufs" valeur={restants} onChange={(v) => { setRestants(v); setFait(false) }} />
      </div>
      <button className="principal" onClick={async () => {
        await enregistrer('reglages', { id: 1, stock_depart: { date: aujourdhui(), oeufs: total, ...(Object.keys(tries).length ? { par_calibre: tries } : {}) } })
        setFait(true)
      }}>Enregistrer l’inventaire</button>
      {fait && <p className="ok">Inventaire enregistré ✓</p>}
    </section>
  )
}

function CompteEtSauvegarde() {
  const { reglages } = useDonnees()
  const derniere = reglages[0]?.derniere_sauvegarde
  return (
    <>
      <div className="ligne">
        <span>Dernière sauvegarde Excel</span>
        <strong>{derniere ? formatDate(derniere) : 'jamais'}</strong>
      </div>
      <Link to="/export" className="bouton-lien">Exporter la sauvegarde</Link>
      <button style={{ width: '100%', marginTop: 8 }} onClick={() => seDeconnecter()}>Se déconnecter</button>
    </>
  )
}

function Rubrique({ genre, titre, children }: { genre: Genre; titre: string; children: ReactNode }) {
  return (
    <section className="carte rubrique" aria-label={titre}>
      <h2 className="entete-ligne" style={{ marginTop: 0 }}><Pastille genre={genre} petite />{titre}</h2>
      {children}
    </section>
  )
}

export function Reglages() {
  return (
    <main>
      <Titre genre="reglages">Réglages</Titre>
      <Rubrique genre="stock" titre="Mes produits et prix">
        <Produits />
        <Conditionnements />
        <Inventaire />
      </Rubrique>
      <Rubrique genre="ouvrier" titre="Mes boxes et ouvriers">
        <BoxesEtOuvriers />
        <Ouvriers />
      </Rubrique>
      <Rubrique genre="alerte" titre="Mes alertes">
        <SeuilsAlerte />
        <Courbe />
      </Rubrique>
      <Rubrique genre="compte" titre="Mon compte et sauvegarde">
        <CompteEtSauvegarde />
      </Rubrique>
    </main>
  )
}
