import { useDonnees } from '../../data/useDonnees'
import { boxesFerme } from '../../lib/calculs/boxes'
import type { BoxFerme } from '../../lib/types'
import { ChoixCalibre } from './ChoixCalibre'
import { useAnnuler } from './Annuler'
import { BoutonAjout } from './Pastille'

/** Liste des boxes : la bande qui l'occupe, l'ouvrier qui s'en occupe, et l'ajout d'un box. */
export function BoxesEtOuvriers() {
  const { ouvriers, bandes, reglages, enregistrer } = useDonnees()
  const boxes = boxesFerme(reglages[0], bandes)
  const actives = bandes.filter((b) => !b.supprime_le && !b.date_reforme)
  const sauver = (liste: BoxFerme[]) => enregistrer('reglages', { id: 1, boxes: liste })
  const [bandeauAnnuler, proposerAnnuler] = useAnnuler()
  const dernier = boxes[boxes.length - 1]
  const dernierLibre = boxes.length > 1 && !actives.some((b) => b.box === dernier.numero)
  return (
    <section aria-label="Boxes et ouvriers">
      <h3>Boxes, ouvriers et calibres</h3>
      {boxes.map((x) => {
        const bande = actives.find((b) => b.box === x.numero)
        return (
          <div key={x.numero} className="box-reglage">
            <label className="ligne" style={{ marginBottom: 0 }}>
              <span style={{ color: 'var(--texte)' }}>Box {x.numero} <span className="discret">{bande ? `· ${bande.nom}` : '· libre'}</span></span>
              <select style={{ width: '52%', marginTop: 0 }} value={x.ouvrier_id ?? ''}
                onChange={(e) => sauver(boxes.map((y) => (y.numero === x.numero ? { ...y, ouvrier_id: e.target.value || null } : y)))}>
                <option value="">Sans ouvrier</option>
                {ouvriers.filter((o) => !o.supprime_le && (o.actif || o.id === x.ouvrier_id)).map((o) => <option key={o.id} value={o.id}>{o.nom}</option>)}
              </select>
            </label>
            <ChoixCalibre numero={x.numero} />
          </div>
        )
      })}
      <div className={dernierLibre ? 'grille2' : ''} style={{ marginTop: 8 }}>
        <BoutonAjout style={{ width: '100%' }} onClick={() => sauver([...boxes, { numero: (dernier?.numero ?? 0) + 1, ouvrier_id: null }])}>Nouveau box</BoutonAjout>
        {dernierLibre && <button onClick={() => {
          sauver(boxes.slice(0, -1))
          proposerAnnuler(`Box ${dernier.numero} retiré`, () => sauver(boxes))
        }}>Retirer le box {dernier.numero}</button>}
      </div>
      {bandeauAnnuler}
    </section>
  )
}
