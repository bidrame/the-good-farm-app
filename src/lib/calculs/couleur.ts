/** Classe CSS d'un taux de ponte comparé au taux attendu. */
export function couleurTaux(taux: number, attendu: number): 'ok' | 'moyen' | 'mauvais' {
  if (taux >= attendu - 0.05) return 'ok'
  if (taux >= attendu - 0.15) return 'moyen'
  return 'mauvais'
}
