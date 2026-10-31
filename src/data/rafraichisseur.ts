/**
 * Regroupe les demandes de rechargement : un seul chargement à la fois, au plus un en attente.
 * Les résultats sont donc appliqués dans l'ordre, jamais une ancienne copie après une récente.
 */
export function creerRafraichisseur<T>(charger: () => Promise<T>, appliquer: (v: T) => void): () => Promise<void> {
  let enCours: Promise<void> | null = null
  let relancer = false
  const lancer = (): Promise<void> => {
    enCours = charger()
      .then(appliquer)
      .finally(() => {
        enCours = null
        if (relancer) {
          relancer = false
          void lancer().catch(() => undefined)
        }
      })
    return enCours
  }
  return () => {
    if (enCours) {
      relancer = true
      return enCours
    }
    return lancer()
  }
}
