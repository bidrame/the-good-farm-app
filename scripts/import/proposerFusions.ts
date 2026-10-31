import { writeFileSync, mkdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { cleNom } from '../../src/lib/calculs/doublons'
import { lireClasseur } from './lireClasseur'

/** Valeurs saisies dans la colonne Client qui ne désignent pas un client. */
const MOTS_NON_CLIENTS = new Set(['aliment', 'autre', 'autres', 'divers', 'inconnu', 'non specifie', 'client', 'clients', 'fournisseur', '-', 'x'])
const LONGUEUR_MIN_PROCHE = 4

function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}

export type Propositions = {
  sures: { garder: string; fusionner: string[] }[]
  aVerifier: { a: string; b: string; raison: string }[]
  pasClients: string[]
}

/** `noms` : chaque occurrence de la colonne Client (les répétitions comptent pour choisir l'orthographe gardée). */
export function proposerFusions(noms: string[]): Propositions {
  const groupes = new Map<string, Map<string, number>>()
  for (const n of noms) {
    const g = groupes.get(cleNom(n)) ?? new Map<string, number>()
    g.set(n, (g.get(n) ?? 0) + 1)
    groupes.set(cleNom(n), g)
  }
  const representants = new Map<string, string>()
  const sures: Propositions['sures'] = []
  for (const [cle, g] of groupes) {
    const tries = [...g.entries()].sort((x, y) => y[1] - x[1])
    representants.set(cle, tries[0][0])
    if (tries.length > 1) sures.push({ garder: tries[0][0], fusionner: tries.slice(1).map(([n]) => n) })
  }
  const pasClients = [...representants].filter(([cle]) => MOTS_NON_CLIENTS.has(cle)).map(([, n]) => n)
  const cles = [...representants.keys()].filter((c) => !MOTS_NON_CLIENTS.has(c))
  const aVerifier: Propositions['aVerifier'] = []
  for (let i = 0; i < cles.length; i++)
    for (let j = i + 1; j < cles.length; j++)
      if (Math.min(cles[i].length, cles[j].length) >= LONGUEUR_MIN_PROCHE && distance(cles[i], cles[j]) === 1)
        aVerifier.push({ a: representants.get(cles[i])!, b: representants.get(cles[j])!, raison: 'une lettre de différence' })
  return { sures, aVerifier, pasClients }
}

export function versCsv(p: Propositions): string {
  const l = ['action;nom;devient;raison']
  for (const s of p.sures) for (const f of s.fusionner) l.push(`fusionner;${f};${s.garder};même nom (majuscules, accents ou espaces)`)
  for (const v of p.aVerifier) l.push(`a_verifier;${v.b};${v.a};${v.raison} : remplacer a_verifier par fusionner ou ignorer`)
  for (const n of p.pasClients) l.push(`retirer;${n};;ne ressemble pas à un client`)
  return l.join('\n') + '\n'
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const lu = lireClasseur(process.argv[2])
  const p = proposerFusions(lu.transactions.map((t) => t.client).filter((c): c is string => !!c))
  mkdirSync('import', { recursive: true })
  writeFileSync('import/fusions.csv', versCsv(p))
  console.log(`import/fusions.csv : ${p.sures.length} fusions sûres, ${p.aVerifier.length} à vérifier, ${p.pasClients.length} à retirer`)
}
