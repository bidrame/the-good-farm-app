import { IconMinus, IconPlus } from '@tabler/icons-react'

/** Nombre réglable avec − et +, au milieu d'une phrase. */
export function Reglette({ libelle, valeur, onChange, min, max, pas = 1 }: { libelle: string; valeur: number; onChange: (n: number) => void; min: number; max: number; pas?: number }) {
  const borne = (n: number) => Math.min(max, Math.max(min, n))
  return (
    <span className="reglette">
      <button type="button" aria-label={`${libelle} : moins`} onClick={() => onChange(borne(valeur - pas))} disabled={valeur <= min}><IconMinus size={18} /></button>
      <input aria-label={libelle} inputMode="numeric" value={valeur || ''}
        onChange={(e) => onChange(Math.min(max, Number(e.target.value.replace(/\D/g, '')) || 0))} onBlur={() => onChange(borne(valeur))} />
      <button type="button" aria-label={`${libelle} : plus`} onClick={() => onChange(borne(valeur + pas))} disabled={valeur >= max}><IconPlus size={18} /></button>
    </span>
  )
}
