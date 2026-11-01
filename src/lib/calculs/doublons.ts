import type { Client, Transaction } from '../types'

/** Clé de comparaison des noms : minuscules, sans accents, espaces réduits. */
export function cleNom(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

export function estDoublonTransaction(t: Transaction, existantes: Transaction[]): boolean {
  return existantes.some(
    (e) =>
      e.id !== t.id && !e.supprime_le && e.date === t.date && e.type === t.type &&
      e.client_id === t.client_id && e.produit_id === t.produit_id && e.montant === t.montant,
  )
}

/** Clé plus stricte : seulement lettres et chiffres (« Mame-Diarra » = « mame diarra »). */
const cleStricte = (s: string) => cleNom(s).replace(/[^a-z0-9]/g, '')
/** Les 9 derniers chiffres : « +221 77 123 45 67 » = « 771234567 ». */
export const cleTelephone = (t: string | null | undefined) => (t ?? '').replace(/\D/g, '').slice(-9)

function distance(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let diag = d[0]
    d[0] = i
    for (let j = 1; j <= b.length; j++) {
      const haut = d[j]
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = haut
    }
  }
  return d[b.length]
}

/** Deux noms qui se ressemblent : l'un contient l'autre, ou une à deux lettres d'écart (« Moussa » / « Mousa »). */
function seRessemblent(a: string, b: string): boolean {
  if (a.length < 3 || b.length < 3) return false
  if (a.includes(b) || b.includes(a)) return true
  const ecartPermis = Math.min(a.length, b.length) >= 8 ? 2 : Math.min(a.length, b.length) >= 4 ? 1 : 0
  return distance(a, b) <= ecartPermis
}

/**
 * Avant d'ajouter un client ou fournisseur : même nom (bloquant), même numéro (bloquant)
 * et noms proches (à confirmer : « c'est bien une autre personne »).
 */
export function personnesSemblables(nom: string, telephone: string | null | undefined, personnes: Client[]) {
  const cle = cleStricte(nom)
  const tel = cleTelephone(telephone)
  const actives = personnes.filter((p) => !p.supprime_le)
  const identique = cle ? actives.find((p) => cleStricte(p.nom) === cle) : undefined
  const memeNumero = tel.length >= 7 ? actives.find((p) => cleTelephone(p.telephone) === tel) : undefined
  const proches = actives.filter((p) => p !== identique && p !== memeNumero && seRessemblent(cle, cleStricte(p.nom))).slice(0, 5)
  return { identique, memeNumero, proches }
}
