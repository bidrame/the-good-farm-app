import { useEffect, useRef, useState } from 'react'

const DUREE_MS = 650

function mouvementReduit(): boolean {
  return typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Nombre qui « compte » jusqu'à sa valeur ; valeur finale immédiate si le téléphone limite les animations. */
export function Compteur({ valeur, format }: { valeur: number; format: (n: number) => string }) {
  const [affiche, setAffiche] = useState(() => (mouvementReduit() ? valeur : 0))
  const depart = useRef(affiche)
  useEffect(() => {
    if (mouvementReduit()) {
      setAffiche(valeur)
      return
    }
    const de = depart.current
    const t0 = performance.now()
    let id = 0
    const pas = (t: number) => {
      const p = Math.min(1, (t - t0) / DUREE_MS)
      const v = de + (valeur - de) * (1 - Math.pow(1 - p, 3))
      setAffiche(p < 1 ? Math.round(v) : valeur)
      depart.current = valeur
      if (p < 1) id = requestAnimationFrame(pas)
    }
    id = requestAnimationFrame(pas)
    return () => cancelAnimationFrame(id)
  }, [valeur])
  return <>{format(affiche)}</>
}

/** Coche qui se dessine après un enregistrement réussi. */
export function CocheSucces({ taille = 72 }: { taille?: number }) {
  return (
    <svg className="coche" width={taille} height={taille} viewBox="0 0 52 52" aria-hidden="true">
      <circle cx="26" cy="26" r="24" strokeWidth="2" />
      <path d="M15 27 l7 7 l15 -16" fill="none" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Petite vibration de confirmation, si le téléphone le permet. */
export function vibrer() {
  try {
    navigator.vibrate?.(25)
  } catch {
    /* non disponible */
  }
}
