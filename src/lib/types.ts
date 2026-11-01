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
  /** Ventes d'œufs : nombre d'œufs par unité vendue (30 = plateau). Absent = 30. */
  oeufs_par_unite?: number | null
  /** Ventes d'œufs : calibre vendu (absent = non précisé). */
  calibre?: Calibre | null
  observation?: string | null
}

export type ModePaiement = 'especes' | 'wave' | 'orange_money' | 'virement' | 'autre'

export interface Paiement extends Audit {
  id: string
  /** Client ou fournisseur (même table). */
  client_id: string
  /** Absent = paiement reçu d'un client. */
  sens?: 'client' | 'fournisseur'
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

/** Numéro de box (1, 2, 3…) : la ferme peut en ajouter. */
export type Box = number

/** Un box de la ferme et l'ouvrier qui s'en occupe (il reste quand les bandes changent). */
export type Calibre = 'petit' | 'moyen' | 'gros'

export interface BoxFerme {
  numero: Box
  ouvrier_id: string | null
  /** Calibre des œufs du box, choisi à la main (toute la bande pond à peu près pareil). */
  calibre?: Calibre | null
}

export interface Bande extends Audit {
  id: string
  nom: string
  box: Box
  ouvrier_id: string | null
  date_naissance: DateISO
  effectif_initial: number
  date_reforme: DateISO | null
  observations?: string | null
  /** Effectif initial compté pour de bon (sinon il est estimé d'après la ponte). */
  effectif_verifie?: boolean
}

/** Recomptage des poules d'une bande : l'effectif repart de ce nombre le lendemain. */
export interface Recensement extends Audit {
  id: string
  bande_id: string
  date: DateISO
  effectif: number
  observation?: string | null
}

/** Morts constatées hors saisie de ponte. */
export interface Mortalite extends Audit {
  id: string
  bande_id: string
  date: DateISO
  nombre: number
  observation?: string | null
}

export interface LigneRamassage {
  /** 0 : chargement global au magasin (sinon numéro de box, anciens ramassages). */
  numero: Box
  /** Œufs attendus d'après la ponte saisie jusqu'à la veille. */
  theorique: number
  /** Œufs chargés en tout, y compris ceux ramassés le matin même. */
  charge: number
  /** Œufs de la collecte du matin du jour du passage : ils seront comptés le soir dans la ponte du jour. */
  matin?: number | null
  /** Calibre de ces œufs (une ligne par calibre) ; absent = non classé. */
  calibre?: Calibre | null
}

/** Plateaux du chargement vendus à un client ; la vente correspondante est `transaction_id`. */
export interface LigneRepartition {
  client_id: string
  calibre?: Calibre | null
  plateaux: number
  prix: number
  transaction_id: string
}

export interface Ramassage extends Audit {
  id: string
  /** Jour du passage de la voiture ; il emporte les œufs pondus de `du` à la veille de `date`. */
  date: DateISO
  du: DateISO
  lignes: LigneRamassage[]
  repartition?: LigneRepartition[] | null
  observation?: string | null
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
  /** Baisse des œufs d'une bande (en %) par rapport à sa moyenne des 7 jours précédents. */
  baisse_pct: number
  /** Alerte de mortalité facultative : le suivi se fait d'abord sur les œufs du jour. */
  alerte_mortalite: boolean
  mortalite_pour_mille: number
  jours_sauvegarde: number
  jours_dette: number
}

export interface Conditionnement {
  nom: string
  oeufs: number
}

/** Inventaire de départ du stock d'œufs : compté le jour `date` (ponte et ventes de ce jour incluses). */
export interface StockDepart {
  date: DateISO
  oeufs: number
  /** Œufs comptés par calibre ; le reste de `oeufs` est « non classé ». */
  par_calibre?: Partial<Record<Calibre, number>> | null
}

/** Suivi du stock d'aliment des pondeuses. */
export interface ReglagesAliment {
  produit_ids?: string[] | null
  kg_par_sac?: number | null
  /** Sacs comptés au magasin le jour `date`. */
  stock?: { date: DateISO; sacs: number } | null
  jours_alerte?: number | null
}

export interface Reglages {
  courbe_attendue?: [number, number][] | null
  derniere_sauvegarde?: DateISO | null
  seuils?: Partial<Seuils> | null
  conditionnements?: Conditionnement[] | null
  stock_depart?: StockDepart | null
  boxes?: BoxFerme[] | null
  aliment?: ReglagesAliment | null
  /** Produits de dépense exclus du prix de revient des œufs. */
  couts_exclus?: string[] | null
  /** Produits de dépense comptés comme coûts directs dans la marge brute. */
  couts_directs?: string[] | null
}
