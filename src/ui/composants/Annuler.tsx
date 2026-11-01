import { useEffect, useState, type ReactNode } from 'react'

const DUREE = 5000

/** Après une suppression sans confirmation : un bandeau « Annuler » pendant 5 secondes. À afficher là où l'action a eu lieu. */
export function useAnnuler(): [ReactNode, (message: string, annuler: () => void) => void] {
  const [offre, setOffre] = useState<{ message: string; annuler: () => void; n: number } | null>(null)
  useEffect(() => {
    if (!offre) return
    const t = setTimeout(() => setOffre(null), DUREE)
    return () => clearTimeout(t)
  }, [offre])
  const bandeau = offre && (
    <div className="toast-annuler" role="status">
      <span>{offre.message}</span>
      <button type="button" onClick={() => { offre.annuler(); setOffre(null) }}>Annuler</button>
    </div>
  )
  return [bandeau, (message, annuler) => setOffre((o) => ({ message, annuler, n: (o?.n ?? 0) + 1 }))]
}
