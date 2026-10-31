import { useState } from 'react'
import { seDeconnecter } from '../../data/auth'
import { useDonnees } from '../../data/useDonnees'
import { SEUILS_DEFAUT } from '../../lib/calculs/alertes'
import { CONDITIONNEMENTS_DEFAUT, OEUFS_PAR_PLATEAU, enOeufs } from '../../lib/calculs/oeufs'
import { COURBE_DEFAUT } from '../../lib/calculs/ponte'
import { aujourdhui, formatDate } from '../../lib/format'
import { ChampMontant } from '../composants/communs'
import type { Conditionnement, Seuils } from '../../lib/types'
import type { TypeTx, Unite } from '../../lib/types'

const UNITES: [Unite, string][] = [['plaque', 'Plaque de 30'], ['unite', 'Unité'], ['kg', 'Kg'], ['forfait', 'Forfait'], ['autre', 'Autre']]

function Courbe() {
  const { reglages, enregistrer } = useDonnees()
  const [points, setPoints] = useState<[number, number][]>(() => reglages[0]?.courbe_attendue ?? COURBE_DEFAUT)
  const [fait, setFait] = useState(false)
  return (
    <section className="carte">
      <h2 style={{ marginTop: 0 }}>Courbe de ponte attendue</h2>
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
      <button className="principal" onClick={async () => {
        await enregistrer('reglages', { id: 1, courbe_attendue: points })
        setFait(true)
      }}>Enregistrer la courbe</button>
      {fait && <p className="ok">Enregistré ✓</p>}
    </section>
  )
}

function Produits() {
  const { produits, enregistrer } = useDonnees()
  const [nom, setNom] = useState('')
  const [type, setType] = useState<TypeTx>('vente')
  const [unite, setUnite] = useState<Unite>('unite')
  return (
    <section className="carte">
      <h2 style={{ marginTop: 0 }}>Produits</h2>
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
      <button onClick={async () => {
        if (!nom.trim()) return
        await enregistrer('produits', { nom: nom.trim(), type, unite, actif: true })
        setNom('')
      }}>Ajouter le produit</button>
    </section>
  )
}

function Ouvriers() {
  const { ouvriers, enregistrer } = useDonnees()
  const [nom, setNom] = useState('')
  return (
    <section className="carte">
      <h2 style={{ marginTop: 0 }}>Ouvriers</h2>
      {ouvriers.filter((o) => !o.supprime_le && o.actif).map((o) => (
        <div className="ligne" key={o.id}>
          <span>{o.nom}</span>
          <button className="lien" aria-label={`Désactiver ${o.nom}`} onClick={() => enregistrer('ouvriers', { ...o, actif: false })}>Désactiver</button>
        </div>
      ))}
      <label>Nouvel ouvrier<input value={nom} onChange={(e) => setNom(e.target.value)} /></label>
      <button onClick={async () => {
        if (!nom.trim()) return
        await enregistrer('ouvriers', { nom: nom.trim(), actif: true })
        setNom('')
      }}>Ajouter l’ouvrier</button>
    </section>
  )
}

const CHAMPS_SEUILS: [keyof Seuils, string][] = [
  ['baisse_pct', 'Baisse d’œufs signalée (%)'],
  ['mortalite_pour_mille', 'Mortalité signalée (pour mille par jour)'],
  ['jours_sauvegarde', 'Rappel de sauvegarde (jours)'],
  ['jours_dette', 'Dette fournisseur signalée après (jours)'],
]

function SeuilsAlerte() {
  const { reglages, enregistrer } = useDonnees()
  const [s, setS] = useState<Seuils>(() => ({ ...SEUILS_DEFAUT, ...reglages[0]?.seuils }))
  const [fait, setFait] = useState(false)
  return (
    <section className="carte">
      <h2 style={{ marginTop: 0 }}>Seuils d’alerte</h2>
      {CHAMPS_SEUILS.map(([cle, libelle]) => (
        <label key={cle}>
          {libelle}
          <input inputMode="numeric" value={s[cle]} onChange={(e) => { setS((x) => ({ ...x, [cle]: Number(e.target.value.replace(/\D/g, '')) })); setFait(false) }} />
        </label>
      ))}
      <button className="principal" onClick={async () => {
        await enregistrer('reglages', { id: 1, seuils: s })
        setFait(true)
      }}>Enregistrer les seuils</button>
      {fait && <p className="ok">Enregistré ✓</p>}
    </section>
  )
}

function Conditionnements() {
  const { reglages, enregistrer } = useDonnees()
  const liste: Conditionnement[] = reglages[0]?.conditionnements?.length ? reglages[0].conditionnements : CONDITIONNEMENTS_DEFAUT
  const [nom, setNom] = useState('')
  const [oeufs, setOeufs] = useState<number | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const sauver = (l: Conditionnement[]) => enregistrer('reglages', { id: 1, conditionnements: l })
  return (
    <section className="carte" aria-label="Conditionnements des œufs">
      <h2 style={{ marginTop: 0 }}>Conditionnements des œufs</h2>
      {liste.map((c) => (
        <div className="ligne" key={c.oeufs}>
          <span>{c.nom} <span className="discret">· {c.oeufs} œufs</span></span>
          {c.oeufs !== OEUFS_PAR_PLATEAU && (
            <button className="lien" aria-label={`Retirer ${c.nom}`} onClick={() => sauver(liste.filter((x) => x.oeufs !== c.oeufs))}>Retirer</button>
          )}
        </div>
      ))}
      <div className="grille2" style={{ marginTop: 8 }}>
        <label>Nom<input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Plateau de 20" /></label>
        <ChampMontant libelle="Œufs" valeur={oeufs} onChange={setOeufs} />
      </div>
      {erreur && <div className="erreur">{erreur}</div>}
      <button onClick={async () => {
        if (!nom.trim() || !oeufs || oeufs <= 0) return setErreur('Nom et nombre d’œufs obligatoires.')
        if (liste.some((c) => c.oeufs === oeufs)) return setErreur('Ce nombre d’œufs existe déjà.')
        setErreur(null)
        await sauver([...liste, { nom: nom.trim(), oeufs }].sort((a, b) => (a.oeufs === OEUFS_PAR_PLATEAU ? -1 : b.oeufs === OEUFS_PAR_PLATEAU ? 1 : b.oeufs - a.oeufs)))
        setNom('')
        setOeufs(null)
      }}>Ajouter</button>
    </section>
  )
}

function Inventaire() {
  const { reglages, enregistrer } = useDonnees()
  const depart = reglages[0]?.stock_depart
  const [plateaux, setPlateaux] = useState<number | null>(null)
  const [restants, setRestants] = useState<number | null>(null)
  const [fait, setFait] = useState(false)
  return (
    <section className="carte" aria-label="Inventaire des œufs">
      <h2 style={{ marginTop: 0 }}>Inventaire des œufs</h2>
      <p className="discret" style={{ marginTop: 0 }}>
        Comptez les œufs en stock ce soir : l’appli suivra ensuite le stock toute seule (ponte − pertes − ventes).
        {depart && ` Dernier inventaire : ${depart.oeufs} œufs le ${formatDate(depart.date)}.`}
      </p>
      <div className="grille2">
        <ChampMontant libelle="Plateaux de 30" valeur={plateaux} onChange={(v) => { setPlateaux(v); setFait(false) }} />
        <ChampMontant libelle="+ œufs" valeur={restants} onChange={(v) => { setRestants(v); setFait(false) }} />
      </div>
      <button className="principal" onClick={async () => {
        await enregistrer('reglages', { id: 1, stock_depart: { date: aujourdhui(), oeufs: enOeufs(plateaux ?? 0, OEUFS_PAR_PLATEAU, restants ?? 0) } })
        setFait(true)
      }}>Enregistrer l’inventaire</button>
      {fait && <p className="ok">Inventaire enregistré ✓</p>}
    </section>
  )
}

export function Reglages() {
  return (
    <main>
      <h1>Réglages</h1>
      <Inventaire />
      <Conditionnements />
      <Courbe />
      <SeuilsAlerte />
      <Produits />
      <Ouvriers />
      <button style={{ width: '100%' }} onClick={() => seDeconnecter()}>Se déconnecter</button>
    </main>
  )
}
