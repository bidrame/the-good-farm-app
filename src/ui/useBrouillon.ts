import { useEffect, useState } from 'react'

/** État de formulaire gardé en sessionStorage : rien n'est perdu si l'écran se recharge (session expirée…). */
/** `ajuster` corrige un brouillon relu (ex. remettre la date du jour s'il n'a pas été commencé). */
export function useBrouillon<T>(cle: string, initial: () => T, ajuster: (b: T) => T = (b) => b): [T, (v: T | ((p: T) => T)) => void, () => void] {
  const [etat, setEtat] = useState<T>(() => {
    try {
      const s = sessionStorage.getItem(cle)
      if (s) return ajuster({ ...initial(), ...JSON.parse(s) })
    } catch {
      /* stockage indisponible */
    }
    return initial()
  })
  useEffect(() => {
    try {
      sessionStorage.setItem(cle, JSON.stringify(etat))
    } catch {
      /* stockage indisponible */
    }
  }, [cle, etat])
  const effacer = () => {
    try {
      sessionStorage.removeItem(cle)
    } catch {
      /* stockage indisponible */
    }
    setEtat(initial())
  }
  return [etat, setEtat, effacer]
}
