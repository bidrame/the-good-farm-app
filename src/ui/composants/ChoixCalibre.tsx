import { useDonnees } from '../../data/useDonnees'
import { boxesFerme } from '../../lib/calculs/boxes'
import { CALIBRES, NOM_CALIBRE } from '../../lib/calculs/calibres'

/** Trois boutons Gros / Moyen / Petit pour marquer le calibre d'un box ; toucher le choix actuel l'efface. */
export function ChoixCalibre({ numero }: { numero: number }) {
  const { reglages, bandes, enregistrer } = useDonnees()
  const boxes = boxesFerme(reglages[0], bandes)
  const actuel = boxes.find((b) => b.numero === numero)?.calibre ?? null
  const choisir = (c: (typeof CALIBRES)[number]) =>
    enregistrer('reglages', { id: 1, boxes: boxes.map((b) => (b.numero === numero ? { ...b, calibre: b.calibre === c ? null : c } : b)) })
  return (
    <div className="choix-calibre" role="group" aria-label={`Calibre du box ${numero}`}>
      {CALIBRES.map((c) => (
        <button type="button" key={c} className={`calibre-${c}${actuel === c ? ' choisi' : ''}`} aria-pressed={actuel === c} onClick={() => choisir(c)}>
          {NOM_CALIBRE[c]}
        </button>
      ))}
    </div>
  )
}
