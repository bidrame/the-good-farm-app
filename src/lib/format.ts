import type { DateISO } from './types'

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

export function formatFCFA(n: number): string {
  return `${nf.format(Math.round(n))} F`
}

export function formatDate(d: DateISO): string {
  const [a, m, j] = d.split('-')
  return `${j}/${m}/${a}`
}

/**
 * Lit un nombre entier positif tapé au clavier : « 2300 », « 2 300 », « 2.300 », « 2,300 ».
 * Un point ou une virgule suivi de 3 chiffres sépare les milliers ; tout autre décimal ou négatif est refusé (null).
 */
export function parseMontant(s: string): number | null {
  const t = s.replace(/[\s  ]/g, '')
  if (/^\d{1,3}([.,]\d{3})+$/.test(t)) return Number(t.replace(/[.,]/g, ''))
  if (/^\d+$/.test(t)) return Number(t)
  return null
}

const JOUR_MS = 86_400_000

function versMs(d: DateISO): number {
  const [a, m, j] = d.split('-').map(Number)
  return Date.UTC(a, m - 1, j)
}

function depuisMs(ms: number): DateISO {
  return new Date(ms).toISOString().slice(0, 10)
}

export function joursEntre(a: DateISO, b: DateISO): number {
  return Math.round((versMs(b) - versMs(a)) / JOUR_MS)
}

export function ajouterJours(d: DateISO, n: number): DateISO {
  return depuisMs(versMs(d) + n * JOUR_MS)
}

/** Date du jour selon l'heure locale du téléphone. */
export function aujourdhui(): DateISO {
  const t = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`
}
