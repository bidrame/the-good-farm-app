import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
import type { DateISO, TypeTx } from '../../src/lib/types'

export type LigneTx = {
  ligne: number
  date: DateISO
  type: TypeTx
  client: string | null
  produit: string
  prix_unitaire: number
  quantite: number
  montant: number
  observation: string | null
}
export type LigneBande = { nom: string; box: number; ouvrier: string | null; date_naissance: DateISO; effectif_initial: number; date_reforme: DateISO | null; observations: string | null }
export type LignePonte = { date: DateISO; bande: string; oeufs_collectes: number; oeufs_perdus: number; mortalite: number; aliment_kg: number | null; observation: string | null }
export type Rejet = { feuille: string; ligne: number; raison: string }
export type Lu = { transactions: LigneTx[]; bandes: LigneBande[]; pontes: LignePonte[]; rejets: Rejet[] }

type Cellules = Record<string, unknown>

/** Orthographe de référence des produits (l'ancien classeur écrit « Oeufs »). */
const PRODUITS: Record<string, string> = { oeufs: 'Œufs' }

function dateISO(v: unknown): DateISO | null {
  if (typeof v === 'number' && v > 0) {
    const d = XLSX.SSF.parse_date_code(v)
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  if (typeof v === 'string') {
    const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  return null
}

const texte = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null)
const nombre = (v: unknown) => (typeof v === 'number' ? v : null)
const vide = (v: unknown) => v == null || v === ''

function produit(v: unknown): string {
  const t = texte(v)
  if (!t) return 'Non spécifié'
  return PRODUITS[t.toLowerCase()] ?? t
}

function lignes(wb: XLSX.WorkBook, feuille: string): Cellules[] {
  return XLSX.utils.sheet_to_json<Cellules>(wb.Sheets[feuille], { header: 'A', raw: true, defval: null, blankrows: true })
}

export function lireClasseur(chemin: string): Lu {
  const wb = XLSX.read(readFileSync(chemin))
  const rejets: Rejet[] = []

  const transactions: LigneTx[] = []
  lignes(wb, 'Transactions').forEach((r, i) => {
    const ligne = i + 1
    if (ligne === 1) return
    if (vide(r.A) && vide(r.J)) return // ligne de modèle vide
    const date = dateISO(r.A)
    if (!date) return rejets.push({ feuille: 'Transactions', ligne, raison: 'date manquante ou illisible' })
    const type = r.F === 'Vente' ? 'vente' : r.F === 'Dépense' ? 'depense' : null
    if (!type) return rejets.push({ feuille: 'Transactions', ligne, raison: `activité inconnue « ${r.F} »` })
    const montant = Math.abs(nombre(r.J) ?? 0)
    if (!montant) return rejets.push({ feuille: 'Transactions', ligne, raison: 'montant nul' })
    let quantite = Math.abs(nombre(r.I) ?? 0)
    let prix = Math.abs(nombre(r.H) ?? 0)
    if (!quantite || !prix || quantite * prix !== montant) [quantite, prix] = [1, montant]
    if (prix === 1 && quantite > 1) [quantite, prix] = [1, montant] // quantité et prix inversés dans le classeur
    transactions.push({ ligne, date, type, client: texte(r.E), produit: produit(r.G), prix_unitaire: prix, quantite, montant, observation: texte(r.K) })
  })

  const bandes: LigneBande[] = []
  lignes(wb, 'Suivi Bandes').forEach((r, i) => {
    const ligne = i + 1
    if (ligne < 4 || ligne > 15) return
    const nom = texte(r.B)
    const naissance = dateISO(r.E)
    if (!nom || !naissance) return
    bandes.push({
      nom, box: Number(r.C), ouvrier: texte(r.D), date_naissance: naissance, effectif_initial: Number(r.F),
      date_reforme: dateISO(r.M), observations: texte(r.O),
    })
  })

  const pontes: LignePonte[] = []
  lignes(wb, 'Suivi Ponte').forEach((r, i) => {
    const ligne = i + 1
    const date = dateISO(r.A)
    const bande = texte(r.B)
    if (ligne < 4 || !date || !bande?.startsWith('BANDE')) return
    pontes.push({
      date, bande, oeufs_collectes: nombre(r.F) ?? 0, oeufs_perdus: nombre(r.G) ?? 0, mortalite: nombre(r.J) ?? 0,
      aliment_kg: nombre(r.K), observation: texte(r.M),
    })
  })

  return { transactions, bandes, pontes, rejets }
}
