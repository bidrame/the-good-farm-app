import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { cleNom } from '../../src/lib/calculs/doublons'
import type { Bande, Client, Ouvrier, Ponte, Produit, Transaction } from '../../src/lib/types'
import type { Lu } from './lireClasseur'

export type Fusion = { action: 'fusionner' | 'a_verifier' | 'ignorer' | 'retirer'; nom: string; devient: string; raison: string }

export type Import = {
  clients: Client[]
  produits: Produit[]
  ouvriers: Ouvrier[]
  bandes: Bande[]
  transactions: Transaction[]
  ponte: Ponte[]
}

/** UUID déterministe (format v5) : relancer l'import met à jour les mêmes lignes au lieu de les dupliquer. */
export function idStable(...parts: (string | number)[]): string {
  const h = createHash('sha1').update(`the-good-farm|${parts.join('|')}`).digest('hex')
  const variante = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variante}${h.slice(17, 20)}-${h.slice(20, 32)}`
}

export function lireFusionsCsv(csv: string): Fusion[] {
  return csv
    .split(/\r?\n/)
    .slice(1)
    .filter((l) => l.trim())
    .map((l) => {
      const [action, nom, devient, raison] = l.split(';')
      return { action: action.trim() as Fusion['action'], nom: nom.trim(), devient: (devient ?? '').trim(), raison: (raison ?? '').trim() }
    })
}

export function construireImport(lu: Lu, fusions: Fusion[]): Import {
  const restantes = fusions.filter((f) => f.action === 'a_verifier')
  if (restantes.length > 0) throw new Error(`Fusions encore à vérifier : ${restantes.map((f) => f.nom).join(', ')}`)
  const devient = new Map(fusions.filter((f) => f.action === 'fusionner').map((f) => [f.nom, f.devient]))
  const retires = new Set(fusions.filter((f) => f.action === 'retirer').map((f) => f.nom))

  // Orthographe gardée par client : après fusions, la plus fréquente parmi les variantes de même clé.
  const compte = new Map<string, Map<string, number>>()
  const nomFinal = (n: string | null) => (n == null || retires.has(n) ? null : devient.get(n) ?? n)
  for (const t of lu.transactions) {
    const n = nomFinal(t.client)
    if (!n) continue
    const g = compte.get(cleNom(n)) ?? new Map<string, number>()
    g.set(n, (g.get(n) ?? 0) + 1)
    compte.set(cleNom(n), g)
  }
  const clients: Client[] = [...compte].map(([cle, g]) => ({ id: idStable('client', cle), nom: [...g.entries()].sort((a, b) => b[1] - a[1])[0][0] }))
  const idClient = (n: string | null) => {
    const f = nomFinal(n)
    return f ? idStable('client', cleNom(f)) : null
  }

  const produits = new Map<string, Produit>()
  const idProduit = (nom: string, type: Transaction['type']) => {
    const id = idStable('produit', type, cleNom(nom))
    if (!produits.has(id)) produits.set(id, { id, nom, type, unite: nom === 'Œufs' ? 'plaque' : 'unite', actif: true })
    return id
  }

  const transactions: Transaction[] = lu.transactions.map((t) => ({
    id: idStable('transaction', t.ligne), date: t.date, type: t.type, client_id: idClient(t.client), produit_id: idProduit(t.produit, t.type),
    prix_unitaire: t.prix_unitaire, quantite: t.quantite, montant: t.montant, montant_paye: t.type === 'vente' ? t.montant : 0, observation: t.observation,
  }))

  const ouvriers = new Map<string, Ouvrier>()
  const bandes: Bande[] = lu.bandes.map((b) => {
    let ouvrier_id: string | null = null
    if (b.ouvrier) {
      ouvrier_id = idStable('ouvrier', cleNom(b.ouvrier))
      ouvriers.set(ouvrier_id, { id: ouvrier_id, nom: b.ouvrier, actif: !b.date_reforme })
    }
    return {
      id: idStable('bande', b.nom), nom: b.nom, box: b.box as Bande['box'], ouvrier_id, date_naissance: b.date_naissance,
      effectif_initial: b.effectif_initial, date_reforme: b.date_reforme, observations: b.observations,
    }
  })
  for (const o of ouvriers.values()) o.actif = bandes.some((b) => b.ouvrier_id === o.id && !b.date_reforme)

  const ponte = new Map<string, Ponte>()
  for (const p of lu.pontes) {
    const id = idStable('ponte', p.bande, p.date)
    ponte.set(id, { id, date: p.date, bande_id: idStable('bande', p.bande), oeufs_collectes: p.oeufs_collectes, oeufs_perdus: p.oeufs_perdus, mortalite: p.mortalite, aliment_kg: p.aliment_kg, observation: p.observation })
  }

  return { clients, produits: [...produits.values()], ouvriers: [...ouvriers.values()], bandes, transactions, ponte: [...ponte.values()] }
}

type Totaux = { ventes: number; depenses: number }

export function totauxParAnnee(txs: Pick<Transaction, 'date' | 'type' | 'montant'>[]): Record<string, Totaux> {
  const r: Record<string, Totaux> = {}
  const ajouter = (cle: string, t: Pick<Transaction, 'type' | 'montant'>) => {
    r[cle] ??= { ventes: 0, depenses: 0 }
    if (t.type === 'vente') r[cle].ventes += t.montant
    else r[cle].depenses += t.montant
  }
  for (const t of txs) {
    ajouter(t.date.slice(0, 4), t)
    ajouter('total', t)
  }
  return r
}

/** Totaux du classeur d'origine, lus dans un fichier local jamais commité (données de la ferme). */
export function lireTotauxAttendus(chemin = 'import/totaux-attendus.json'): Record<string, Totaux> {
  return JSON.parse(readFileSync(chemin, 'utf8'))
}
