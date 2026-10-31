/** Date métier au format YYYY-MM-DD, jamais un objet Date (pas de décalage de fuseau). */
export type DateISO = string

export type TypeTx = 'vente' | 'depense'

export interface Audit {
  cree_le?: string
  cree_par?: string
  modifie_le?: string
  modifie_par?: string
  supprime_le?: string | null
}

export interface Client extends Audit {
  id: string
  nom: string
  telephone?: string | null
  notes?: string | null
}

export type Unite = 'plaque' | 'unite' | 'kg' | 'forfait' | 'autre'

export interface Produit extends Audit {
  id: string
  nom: string
  type: TypeTx
  unite: Unite
  actif: boolean
}

export interface Transaction extends Audit {
  id: string
  date: DateISO
  type: TypeTx
  client_id: string | null
  produit_id: string
  prix_unitaire: number
  quantite: number
  montant: number
  montant_paye: number
  observation?: string | null
}

export type ModePaiement = 'especes' | 'wave' | 'orange_money' | 'virement' | 'autre'

export interface Paiement extends Audit {
  id: string
  client_id: string
  date: DateISO
  montant: number
  mode: ModePaiement
  observation?: string | null
}

export interface Ouvrier extends Audit {
  id: string
  nom: string
  actif: boolean
}

export type Box = 1 | 2 | 3 | 4

export interface Bande extends Audit {
  id: string
  nom: string
  box: Box
  ouvrier_id: string | null
  date_naissance: DateISO
  effectif_initial: number
  date_reforme: DateISO | null
  observations?: string | null
}

export interface Ponte extends Audit {
  id: string
  date: DateISO
  bande_id: string
  oeufs_collectes: number
  oeufs_perdus: number
  mortalite: number
  aliment_kg: number | null
  observation?: string | null
}

export interface Seuils {
  baisse_points: number
  mortalite_pour_mille: number
  jours_sauvegarde: number
}

export interface Reglages {
  courbe_attendue?: [number, number][] | null
  derniere_sauvegarde?: DateISO | null
  seuils?: Partial<Seuils> | null
}
