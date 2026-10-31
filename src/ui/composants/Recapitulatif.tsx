import type { ReactNode } from 'react'
import { IconCheck, IconPencil } from '@tabler/icons-react'
import { CocheSucces } from './animations'
import { IconeBouton } from './Pastille'

/** Résumé d'une saisie avant validation, avec retour rapide au formulaire. */
export function Recapitulatif({ titre, lignes, total, onModifier, onValider, enCours, libelleValider = 'Valider' }: {
  titre: string
  lignes: [string, ReactNode][]
  total?: [string, ReactNode]
  onModifier: () => void
  onValider: () => void
  enCours?: boolean
  libelleValider?: string
}) {
  return (
    <section aria-label="Récapitulatif" className="carte recap">
      <h2 style={{ marginTop: 0 }}>{titre}</h2>
      {lignes.map(([l, v]) => (
        <div className="ligne" key={l}><span>{l}</span><strong>{v}</strong></div>
      ))}
      {total && <div className="ligne"><span>{total[0]}</span><span className="total">{total[1]}</span></div>}
      <div className="grille2" style={{ marginTop: 12 }}>
        <button type="button" onClick={onModifier}><IconeBouton Icone={IconPencil} />Modifier</button>
        <button type="button" className="principal" disabled={enCours} onClick={onValider}>{!enCours && <IconeBouton Icone={IconCheck} />}{enCours ? 'Enregistrement…' : libelleValider}</button>
      </div>
    </section>
  )
}

/** Écran de réussite avec coche animée et message encourageant. */
export function Reussite({ message, detail, action, onAction }: { message: string; detail?: string; action: string; onAction: () => void }) {
  return (
    <div className="carte" role="status" style={{ textAlign: 'center', padding: '24px 16px' }}>
      <CocheSucces />
      <p style={{ fontSize: 20, fontWeight: 800, margin: '10px 0 4px' }}>{message}</p>
      {detail && <p className="discret" style={{ marginTop: 0 }}>{detail}</p>}
      <button className="principal" onClick={onAction}>{action}</button>
    </div>
  )
}
