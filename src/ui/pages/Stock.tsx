import { Link } from 'react-router-dom'
import { useDonnees } from '../../data/useDonnees'
import { boxesFerme } from '../../lib/calculs/boxes'
import { CALIBRES, cle, mouvementsStock, nomCle, ORDRE_CLES, parCalibre, stockParCalibre, type CleCalibre } from '../../lib/calculs/calibres'
import { decomposer, OEUFS_PAR_PLATEAU, stockOeufs } from '../../lib/calculs/oeufs'
import { formatDate } from '../../lib/format'
import { EtatVide, Titre } from '../composants/Pastille'

function enPlateaux(oeufs: number): string {
  const { lots, restants } = decomposer(oeufs, OEUFS_PAR_PLATEAU)
  return `${lots} plateau${lots > 1 ? 'x' : ''}${restants ? ` + ${restants}` : ''}`
}

/** « Gros 171 · Moyen 133 · Petit 110 » (en plateaux entiers). */
function Calibres({ oeufs, signe = '' }: { oeufs: Partial<Record<CleCalibre, number>>; signe?: string }) {
  return (
    <span className="calibres-ligne">
      {ORDRE_CLES.filter((k) => oeufs[k]).map((k) => (
        <span key={k}><span className={`pastille-calibre ${k}`}>{nomCle(k)}</span> {signe}{Math.floor(oeufs[k]! / OEUFS_PAR_PLATEAU)}</span>
      ))}
    </span>
  )
}

const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
const jourSemaine = (d: string) => JOURS[new Date(`${d}T12:00:00`).getDay()]

/** Le magasin : ce qu'il contient par calibre, puis jour par jour ce qui est entré (box par box) et sorti (livraisons, ventes). */
export function Stock() {
  const { ponte, transactions, produits, bandes, reglages } = useDonnees()
  const depart = reglages[0]?.stock_depart
  if (!depart)
    return (
      <main>
        <Titre genre="stock">Stock d’œufs</Titre>
        <EtatVide genre="stock" message="Faites un premier inventaire du magasin pour suivre le stock.">
          <Link to="/reglages" className="bouton-lien">Faire l’inventaire</Link>
        </EtatVide>
      </main>
    )

  const boxes = boxesFerme(reglages[0], bandes)
  const total = Math.max(0, stockOeufs({ pontes: ponte, transactions, produits, depart }))
  const parCal = stockParCalibre({ pontes: ponte, transactions, produits, depart, bandes, boxes })
  const jours = mouvementsStock({ pontes: ponte, transactions, produits, depart, bandes, boxes })
  const inventaire: Partial<Record<CleCalibre, number>> = { ...depart.par_calibre }
  const tries = CALIBRES.reduce((s, c) => s + (depart.par_calibre?.[c] ?? 0), 0)
  if (depart.oeufs > tries) inventaire.autre = depart.oeufs - tries

  return (
    <main>
      <Titre genre="stock">Stock d’œufs</Titre>
      <section aria-label="Au magasin" className="vedette">
        <div className="discret">Au magasin aujourd’hui</div>
        <div className="grand">{enPlateaux(total)}</div>
        <div className="calibres-vedette"><Calibres oeufs={parCal} /></div>
      </section>
      <Link to="/livraison" className="bouton-lien" style={{ marginBottom: 12 }}>Préparer une livraison</Link>

      <h2>Jour par jour</h2>
      {jours.length === 0 && <p className="discret">Pas encore de mouvement depuis l’inventaire.</p>}
      {jours.map((j) => {
        const entre = j.entrees.reduce((s, e) => s + e.oeufs, 0)
        const sorti = ORDRE_CLES.reduce((s, k) => s + (j.sorties[k] ?? 0), 0)
        return (
          <article key={j.date} className="carte" aria-label={`Mouvements du ${formatDate(j.date)}`}>
            <div className="ligne" style={{ padding: 0 }}>
              <strong>{jourSemaine(j.date)} {formatDate(j.date)}</strong>
              <span>
                {entre > 0 && <strong className="entree">+{Math.floor(entre / OEUFS_PAR_PLATEAU)}</strong>}
                {entre > 0 && sorti > 0 && ' · '}
                {sorti > 0 && <strong className="sortie">−{Math.floor(sorti / OEUFS_PAR_PLATEAU)}</strong>}
                <span className="discret"> plateaux</span>
              </span>
            </div>
            {entre > 0 && (
              <>
                <div className="discret" style={{ marginTop: 4 }}>Ramassage des box</div>
                {j.entrees.map((e) => (
                  <div key={e.numero} className="ligne" style={{ padding: '2px 0' }}>
                    <span>Box {e.numero} <span className={`pastille-calibre ${cle(e.calibre)}`}>{nomCle(cle(e.calibre))}</span></span>
                    <span>{enPlateaux(e.oeufs)}</span>
                  </div>
                ))}
                <div style={{ marginTop: 2 }}><Calibres oeufs={parCalibre(j.entrees, (e) => e.calibre, (e) => e.oeufs)} signe="+" /></div>
              </>
            )}
            {sorti > 0 && (
              <div style={{ marginTop: 6 }}>
                <span className="discret">Livré · vendu : </span><Calibres oeufs={j.sorties} signe="−" />
              </div>
            )}
          </article>
        )
      })}
      <article className="carte" aria-label="Inventaire de départ">
        <div className="ligne" style={{ padding: 0 }}>
          <strong>Inventaire du {formatDate(depart.date)}</strong>
          <strong>{enPlateaux(depart.oeufs)}</strong>
        </div>
        <Calibres oeufs={inventaire} />
      </article>
    </main>
  )
}
