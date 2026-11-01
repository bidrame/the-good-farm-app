import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDonnees } from '../../data/useDonnees'
import { boxesFerme } from '../../lib/calculs/boxes'
import { decomposer, OEUFS_PAR_PLATEAU } from '../../lib/calculs/oeufs'
import { cle, depuisCle, nomCalibre, nomCle, ORDRE_CLES, parCalibre, stockParCalibre, type CleCalibre } from '../../lib/calculs/calibres'
import { aRamasserParCalibre, resteParCalibre, debutPeriode, dejaEmportes, dernierRamassage, emportesParCalibre, finPonte, inventaireTheorique, repartition, totalCharge, totalMatin, totalTheorique } from '../../lib/calculs/ramassage'
import { ajouterJours, aujourdhui, formatDate } from '../../lib/format'
import type { Calibre, DateISO, Ramassage as TRamassage } from '../../lib/types'
import { Camionnette } from '../composants/Camionnette'
import { ChoixCalibre } from '../composants/ChoixCalibre'
import { ChampMontant, Confirmation } from '../composants/communs'
import { BoutonAjout, EtatVide, Titre } from '../composants/Pastille'
import { Repartition } from '../composants/Repartition'

function enPlateaux(oeufs: number): string {
  const { lots, restants } = decomposer(oeufs, OEUFS_PAR_PLATEAU)
  return `${lots} plateaux${restants ? ` + ${restants}` : ''}`
}

/** « 4 plateaux de moins que prévu » ; rien si l'écart fait moins d'un plateau. */
function Ecart({ theorique, charge }: { theorique: number; charge: number }) {
  // On compare en plateaux entiers : un plateau entamé dans le prévu ne compte pas comme un écart.
  const ecart = Math.round(charge / OEUFS_PAR_PLATEAU) - Math.round(theorique / OEUFS_PAR_PLATEAU)
  const plateaux = Math.abs(ecart)
  if (plateaux === 0) return <span className="ok">conforme</span>
  return <span className={ecart < 0 ? 'mauvais' : 'moyen'}>{plateaux} plateau{plateaux > 1 ? 'x' : ''} de {ecart < 0 ? 'moins' : 'plus'} que prévu</span>
}

/** « Gros 152 · Petit 54 » (en plateaux). */
function LigneCalibres({ quantites, enOeufs = true }: { quantites: Partial<Record<CleCalibre, number>>; enOeufs?: boolean }) {
  const cles = ORDRE_CLES.filter((k) => (quantites[k] ?? 0) > 0)
  if (!cles.length) return null
  return (
    <span className="calibres-ligne">
      {cles.map((k) => (
        <span key={k}><span className={`pastille-calibre ${k}`}>{nomCle(k)}</span> {enOeufs ? Math.round(quantites[k]! / OEUFS_PAR_PLATEAU) : quantites[k]}</span>
      ))}
    </span>
  )
}

/**
 * Chargement global au magasin, calibre par calibre : le prévu (déjà rempli), plus éventuellement
 * le ramassage du matin même, noté box par box : son calibre est celui du box.
 */
function Chargement({ prevus, boxesMatin, du, au, depuisStock = false, onFini }: {
  prevus: Partial<Record<CleCalibre, number>>; boxesMatin: { numero: number; calibre: Calibre | null }[]
  du: DateISO; au: DateISO; depuisStock?: boolean; onFini: (id: string) => void
}) {
  const { enregistrer } = useDonnees()
  const cles = ORDRE_CLES.filter((k) => (prevus[k] ?? 0) > 0)
  const [plateaux, setPlateaux] = useState<Partial<Record<CleCalibre, number | null>>>(() =>
    Object.fromEntries(cles.map((k) => [k, Math.round((prevus[k] ?? 0) / OEUFS_PAR_PLATEAU)])))
  const [apresMatin, setApresMatin] = useState(false)
  const [matin, setMatin] = useState<Record<number, number | null>>({})
  const [observation, setObservation] = useState('')
  const [enCours, setEnCours] = useState(false)
  const matinParCalibre = apresMatin ? parCalibre(boxesMatin, (b) => b.calibre, (b) => matin[b.numero] ?? 0) : {}
  const totalMatin = ORDRE_CLES.reduce((s, k) => s + (matinParCalibre[k] ?? 0), 0)
  // Un calibre peut n'arriver que par le matin (rien au magasin) : il a quand même sa ligne.
  const clesChargees = ORDRE_CLES.filter((k) => cles.includes(k) || (matinParCalibre[k] ?? 0) > 0)
  const prevu = cles.reduce((s, k) => s + (prevus[k] ?? 0), 0)
  const charges = cles.reduce((s, k) => s + (plateaux[k] ?? 0), 0)
  const total = charges + totalMatin
  const complet = cles.every((k) => plateaux[k] != null)

  async function valider() {
    setEnCours(true)
    const id = crypto.randomUUID()
    await enregistrer('ramassages', {
      id, date: au, du, observation: observation.trim() || null, repartition: [],
      lignes: clesChargees.map((k) => ({
        numero: 0, calibre: depuisCle(k), theorique: prevus[k] ?? 0,
        charge: ((plateaux[k] ?? 0) + (matinParCalibre[k] ?? 0)) * OEUFS_PAR_PLATEAU, matin: (matinParCalibre[k] ?? 0) * OEUFS_PAR_PLATEAU,
      })),
    })
    setEnCours(false)
    onFini(id)
  }

  return (
    <form aria-label="Plateaux chargés" className="carte" onSubmit={(e) => { e.preventDefault(); void valider() }}>
      <h2 style={{ marginTop: 0 }}>1. Plateaux chargés au magasin</h2>
      <p className="discret" style={{ marginTop: 0 }}>
        {depuisStock ? 'Stock du magasin, déjà rempli par calibre' : 'Ramassage jusqu’à hier soir, déjà rempli d’après le calibre des box'} : corrigez si le compte diffère.
      </p>
      <div className={cles.length > 1 ? 'grille2' : ''}>
        {cles.map((k) => (
          <ChampMontant key={k} libelle={cles.length > 1 || k !== 'autre' ? nomCle(k) : depuisStock ? 'Plateaux chargés' : 'Plateaux ramassés jusqu’à hier soir'} suffixe="plateaux"
            valeur={plateaux[k] ?? null} onChange={(n) => setPlateaux((p) => ({ ...p, [k]: n }))} />
        ))}
      </div>
      {complet && (
        <div style={{ fontSize: 13, fontWeight: 700, margin: '-4px 0 10px' }}>
          Prévu {enPlateaux(prevu)} · <Ecart theorique={prevu} charge={charges * OEUFS_PAR_PLATEAU} />
        </div>
      )}
      <label className="case">
        <input type="checkbox" checked={apresMatin} onChange={(e) => setApresMatin(e.target.checked)} />
        <span>Le bus part après le ramassage du matin</span>
      </label>
      {apresMatin && (
        <>
          <div className="matin-boxes" role="group" aria-label="Ramassés ce matin">
            <p className="discret" style={{ margin: '0 0 6px' }}>+ Ramassés ce matin, box par box (laissez vide un box non ramassé)</p>
            <div className="grille2">
              {boxesMatin.map((b) => (
                <ChampMontant key={b.numero} libelle={`Box ${b.numero} · ${nomCle(cle(b.calibre))}`}
                  valeur={matin[b.numero] ?? null} onChange={(n) => setMatin((m) => ({ ...m, [b.numero]: n }))} />
              ))}
            </div>
            {totalMatin > 0 && <div style={{ fontWeight: 700 }}>Total du matin : <LigneCalibres quantites={matinParCalibre} enOeufs={false} /></div>}
          </div>
          <p className="discret">La ponte de ce soir les comptera, mais leur vente les aura déjà retirés du stock : rien n’est compté deux fois.</p>
        </>
      )}
      <div className="ligne" style={{ borderTop: '1px solid var(--bord)', marginBottom: 8 }}>
        <span>Total chargé</span><strong>{total} plateau{total > 1 ? 'x' : ''}</strong>
      </div>
      <label>Observation<input value={observation} onChange={(e) => setObservation(e.target.value)} placeholder="casse pendant le transport, chauffeur…" /></label>
      <button type="submit" className="principal" disabled={!complet || enCours} style={{ width: '100%' }}>Continuer vers la répartition</button>
    </form>
  )
}

function LigneRamassage({ r, dernier, onRepartir }: { r: TRamassage; dernier: boolean; onRepartir: () => void }) {
  const { clients, supprimer } = useDonnees()
  const [aSupprimer, setASupprimer] = useState(false)
  const charge = totalCharge(r)
  const { reste } = repartition(r)
  const nomClient = (id: string) => clients.find((c) => c.id === id)?.nom ?? '?'
  return (
    <article className="carte">
      <div className="ligne" style={{ padding: 0 }}>
        <strong>{formatDate(r.date)}</strong>
        <span className="discret">ramassage du {formatDate(r.du)}{r.du < finPonte(r.date) ? ` au ${formatDate(finPonte(r.date))}` : ''}</span>
      </div>
      <div>
        {enPlateaux(charge)} chargés · <Ecart theorique={totalTheorique(r)} charge={charge - totalMatin(r)} />
        {totalMatin(r) > 0 && <span className="discret"> · dont {enPlateaux(totalMatin(r))} ramassés le matin même</span>}
      </div>
      {r.lignes.some((l) => l.calibre) && <div style={{ marginTop: 4 }}><LigneCalibres quantites={parCalibre(r.lignes, (l) => l.calibre, (l) => l.charge)} /></div>}
      {r.lignes.filter((l) => l.numero > 0).map((l) => (
        <div key={l.numero} className="ligne discret" style={{ padding: '2px 0' }}>
          <span>Box {l.numero}</span>
          <span>{enPlateaux(l.charge)} · <Ecart theorique={l.theorique} charge={l.charge} /></span>
        </div>
      ))}
      {(r.repartition?.length ?? 0) > 0 && (
        <div style={{ marginTop: 6 }}>
          <span className="discret">Livré :</span>{' '}
          {r.repartition!.map((l) => `${nomClient(l.client_id)} ${l.plateaux}${l.calibre ? ` ${nomCalibre(l.calibre).toLowerCase()}` : ''}`).join(' · ')}
        </div>
      )}
      <div className="discret" style={{ marginTop: 4 }}>
        {reste > 0 ? <>Reste à répartir : <strong>{reste} plateau{reste > 1 ? 'x' : ''}</strong></> : reste === 0 && charge > 0 ? 'Tout le chargement est réparti ✓' : null}
      </div>
      {dernier && reste > 0 && <BoutonAjout onClick={onRepartir} style={{ width: '100%', margin: '8px 0' }}>Répartir entre les clients</BoutonAjout>}
      {r.observation && <div className="discret">{r.observation}</div>}
      <button className="lien" onClick={() => setASupprimer(true)}>Supprimer</button>
      {aSupprimer && (
        <Confirmation message={`Supprimer la livraison du ${formatDate(r.date)} ? Les ventes déjà créées restent dans l’historique.`} oui="Supprimer"
          onOui={async () => { await supprimer('ramassages', r.id); setASupprimer(false) }} onNon={() => setASupprimer(false)} />
      )}
    </article>
  )
}

/** Jour de départ du bus : aujourd'hui ou demain en un toucher, ou une autre date dans le champ. */
function JourLivraison({ au, onChange }: { au: string; onChange: (d: string) => void }) {
  const auj = aujourdhui()
  return (
    <div className="puces" role="group" aria-label="Raccourcis du jour de livraison" style={{ marginBottom: 12 }}>
      {([[auj, 'Aujourd’hui'], [ajouterJours(auj, 1), 'Demain']] as const).map(([d, l]) => (
        <button key={l} type="button" className={au === d ? 'choisi' : ''} aria-pressed={au === d} onClick={() => onChange(d)}>{l}</button>
      ))}
    </div>
  )
}

export function Ramassage() {
  const { bandes, ponte, ouvriers, ramassages, reglages, transactions, produits } = useDonnees()
  const auj = aujourdhui()
  // Le jour de la livraison n'est pas prérempli : on le choisit avant de charger le bus.
  const [au, setAu] = useState('')
  const jour = au || auj
  const [du, setDu] = useState(() => debutPeriode(ramassages, auj, ponte))
  const [chargement, setChargement] = useState(false)
  const [aRepartir, setARepartir] = useState<string | null>(null)
  const fin = finPonte(jour)
  const inv = inventaireTheorique({ bandes, pontes: ponte, boxes: boxesFerme(reglages[0], bandes) }, du, fin, auj)
  const emportes = dejaEmportes(ramassages, du)
  const parCal = aRamasserParCalibre(inv, emportesParCalibre(ramassages, du))
  const aRamasser = ORDRE_CLES.reduce((s, k) => s + (parCal[k] ?? 0), 0)
  const nomBande = (id: string) => bandes.find((b) => b.id === id)?.nom ?? ''
  const nomOuvrier = (id: string | null) => ouvriers.find((o) => o.id === id)?.nom
  const precedents = ramassages.filter((r) => !r.supprime_le).sort((a, b) => b.date.localeCompare(a.date))
  const dernier = dernierRamassage(ramassages)
  const periodeValide = du <= fin
  const ramassageARepartir = precedents.find((r) => r.id === aRepartir)

  // Stock suivi (inventaire fait) : le bus part de ce qui est au magasin, ramassage du jour compris s'il est saisi.
  const depart = reglages[0]?.stock_depart
  const boxes = boxesFerme(reglages[0], bandes)
  const magasin = depart ? stockParCalibre({ pontes: ponte, transactions, produits, depart, bandes, boxes }) : {}
  // Plateaux déjà chargés mais pas encore répartis entre clients : ils sont dans le bus, pas à recharger.
  const dansBus: Partial<Record<CleCalibre, number>> = {}
  if (depart) for (const r of precedents.filter((x) => x.date >= depart.date)) {
    const reste = resteParCalibre(r)
    for (const k of ORDRE_CLES) if ((reste[k] ?? 0) > 0) dansBus[k] = (dansBus[k] ?? 0) + reste[k]! * OEUFS_PAR_PLATEAU
  }
  // Livraison à une date future : on ajoute la ponte estimée d'ici là (jusqu'à la veille du départ).
  const debutFutur = ponte.some((p) => p.date === auj && !p.supprime_le) ? ajouterJours(auj, 1) : auj
  const futur = depart && jour > auj ? aRamasserParCalibre(inventaireTheorique({ bandes, pontes: ponte, boxes }, debutFutur, finPonte(jour), auj), {}) : {}

  // Box qui ont une bande en place : ce sont eux qu'on peut ramasser le matin.
  const boxesMatin = boxes
    .filter((x) => bandes.some((b) => !b.supprime_le && !b.date_reforme && b.box === x.numero))
    .map((x) => ({ numero: x.numero, calibre: x.calibre ?? null }))

  /** Encadré « Charger le bus et répartir » : le jour de la livraison doit d'abord être choisi. */
  function blocCharger(prevus: Partial<Record<CleCalibre, number>>, debut: DateISO, total: number, depuisStock: boolean) {
    if (jour > auj) return <p className="discret">Livraison à venir : vous noterez les plateaux chargés le jour du départ.</p>
    if (chargement) return <Chargement prevus={prevus} boxesMatin={boxesMatin} du={debut} au={au} depuisStock={depuisStock} onFini={(id) => { setChargement(false); setARepartir(id) }} />
    if (total <= 0) return null
    return (
      <section className="carte" aria-label="Charger et répartir">
        <h2 style={{ marginTop: 0 }}>Charger le bus et répartir</h2>
        <p className="discret" style={{ marginTop: 0 }}>1. Plateaux chargés au magasin · 2. Répartition entre les clients (une vente par client)</p>
        <button className="principal" style={{ width: '100%' }} disabled={!au} onClick={() => setChargement(true)}>Charger et répartir entre les clients</button>
        {!au && <p className="discret" style={{ textAlign: 'center', marginBottom: 0 }}>Choisissez d’abord le jour de la livraison.</p>}
      </section>
    )
  }
  const aLivrer: Partial<Record<CleCalibre, number>> = {}
  for (const k of ORDRE_CLES) {
    const n = Math.max(0, (magasin[k] ?? 0) - (dansBus[k] ?? 0)) + (futur[k] ?? 0)
    if (n > 0) aLivrer[k] = n
  }
  const totalALivrer = ORDRE_CLES.reduce((s, k) => s + (aLivrer[k] ?? 0), 0)
  const totalMagasin = ORDRE_CLES.reduce((s, k) => s + (magasin[k] ?? 0), 0)
  const totalBus = ORDRE_CLES.reduce((s, k) => s + (dansBus[k] ?? 0), 0)
  const totalFutur = ORDRE_CLES.reduce((s, k) => s + (futur[k] ?? 0), 0)

  return (
    <main>
      <Titre genre="ramassage">Livraison</Titre>
      {depart ? (
        <>
          <p className="discret" style={{ marginTop: 0 }}>
            Le bus emporte vers les clients les œufs du magasin, ramassage du jour compris dès qu’il est saisi.
            {dernier ? ` Dernière livraison : ${formatDate(dernier.date)}.` : ''}
          </p>
          <label style={{ marginBottom: 6 }}>Jour de la livraison<input type="date" value={au} onChange={(e) => e.target.value && setAu(e.target.value)} /></label>
          <JourLivraison au={au} onChange={setAu} />
          <section aria-label="Total à livrer" className="vedette vedette-camion">
            <div>
              <div className="discret">Le bus peut emporter{totalFutur ? ' environ' : ''}</div>
              <div className="grand">{enPlateaux(totalALivrer)}</div>
              <div className="calibres-vedette"><LigneCalibres quantites={aLivrer} /></div>
              {(totalBus > 0 || totalFutur > 0) && (
                <div className="discret" style={{ fontSize: 13 }}>
                  au magasin {enPlateaux(totalMagasin)}
                  {totalBus > 0 && ` − ${enPlateaux(totalBus)} encore dans le bus (pas encore répartis)`}
                  {totalFutur > 0 && ` + ≈ ${enPlateaux(totalFutur)} ramassés d’ici le départ`}
                </div>
              )}
            </div>
            <Camionnette />
          </section>
          <Link to="/stock" className="lien" style={{ display: 'block', marginBottom: 12 }}>Voir le stock jour par jour, par box →</Link>
          {blocCharger(aLivrer, jour, totalALivrer, true)}
        </>
      ) : (
      <>
      <p className="discret" style={{ marginTop: 0 }}>
        Le bus emporte vers les clients les œufs ramassés jusqu’à la veille de son départ (œufs cassés retirés).
        {dernier ? ` Dernière livraison : ${formatDate(dernier.date)}.` : ''}
      </p>
      <div className="grille2">
        <label>Ramassage depuis le<input type="date" value={du} onChange={(e) => e.target.value && setDu(e.target.value)} /></label>
        <label>Jour de la livraison<input type="date" value={au} onChange={(e) => e.target.value && setAu(e.target.value)} /></label>
      </div>
      <JourLivraison au={au} onChange={setAu} />

      {!periodeValide ? <div className="erreur">Rien à livrer : le ramassage commence le jour de la livraison ou après.</div> : (
        <>
          <section aria-label="Total à livrer" className="vedette vedette-camion">
            <div>
              <div className="discret">Le bus va emporter{inv.prevus ? ' environ' : ''}</div>
              <div className="discret" style={{ fontSize: 13 }}>ramassage du {formatDate(du)}{du < fin ? ` au ${formatDate(fin)}` : ''}</div>
              <div className="grand">{enPlateaux(aRamasser)}</div>
              <div className="variation">{aRamasser} œufs{inv.prevus ? ` · dont ≈ ${inv.prevus} prévus` : ''}</div>
              {ORDRE_CLES.some((k) => k !== 'autre' && parCal[k]) && <div className="calibres-vedette"><LigneCalibres quantites={parCal} /></div>}
              {emportes > 0 && (
                <div className="discret" style={{ fontSize: 13 }}>
                  ramassage {enPlateaux(inv.total)} − {enPlateaux(emportes)} déjà partis le matin du {formatDate(du)}
                </div>
              )}
            </div>
            <Camionnette />
          </section>

          {blocCharger(parCal, du, aRamasser, false)}

          <h2>Ce que chaque box a pondu</h2>
          {inv.boxes.map((b) => (
            <article key={b.numero} className="carte" aria-label={`Box ${b.numero}`}>
              <div className="ligne" style={{ padding: 0 }}>
                <strong>Box {b.numero}{nomOuvrier(b.ouvrier_id) ? ` · ${nomOuvrier(b.ouvrier_id)}` : ''}</strong>
                <strong>{enPlateaux(b.total)}</strong>
              </div>
              {b.bandes.length === 0 ? <div className="discret">Pas de bande en ponte</div> : (
                <>
                  <div className="discret">
                    {b.bandes.map(nomBande).join(', ')} · {b.total} œufs{b.prevus ? ` dont ≈ ${b.prevus} prévus` : ''}
                  </div>
                  <ChoixCalibre numero={b.numero} />
                </>
              )}
              {b.manquants.length > 0 && (
                <div className="moyen" style={{ fontSize: 13, fontWeight: 700 }}>
                  Ponte non saisie : {b.manquants.map((m) => `${formatDate(m.date)}${b.bandes.length > 1 ? ` (${nomBande(m.bande_id)})` : ''}`).join(', ')} — non comptée
                </div>
              )}
            </article>
          ))}

        </>
      )}
      </>
      )}

      {ramassageARepartir && (
        <Repartition r={ramassageARepartir} precedent={precedents.find((r) => r.date < ramassageARepartir.date && r.repartition?.length) ?? null}
          onFini={() => setARepartir(null)} />
      )}

      <section aria-label="Livraisons précédentes">
        <h2>Livraisons précédentes</h2>
        {precedents.length === 0
          ? <EtatVide genre="ramassage" message="Aucune livraison enregistrée pour l’instant." />
          : precedents.map((r) => <LigneRamassage key={r.id} r={r} dernier={r.id === dernier?.id} onRepartir={() => setARepartir(r.id)} />)}
      </section>
    </main>
  )
}
