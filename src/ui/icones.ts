import {
  IconAlertTriangle, IconCash, IconChartBar, IconCirclePlus, IconCoins, IconDots, IconEgg, IconFeather, IconFileInvoice,
  IconFileSpreadsheet, IconHistory, IconHome, IconHourglass, IconReceipt, IconSettings, IconStack2, IconTrash, IconTruck, IconUser,
  type Icon,
} from '@tabler/icons-react'

/** Une icône et une couleur par type de chose, les mêmes dans toute l’appli. */
export type Genre =
  | 'vente' | 'depense' | 'ponte' | 'bande' | 'client' | 'fournisseur' | 'paiement' | 'credit' | 'aPayer' | 'stock'
  | 'alerte' | 'reglages' | 'export' | 'corbeille' | 'historique' | 'rapports'

export const ICONES: Record<Genre, Icon> = {
  vente: IconCash,
  depense: IconReceipt,
  ponte: IconEgg,
  bande: IconFeather,
  client: IconUser,
  fournisseur: IconTruck,
  paiement: IconCoins,
  credit: IconHourglass,
  aPayer: IconFileInvoice,
  stock: IconStack2,
  alerte: IconAlertTriangle,
  reglages: IconSettings,
  export: IconFileSpreadsheet,
  corbeille: IconTrash,
  historique: IconHistory,
  rapports: IconChartBar,
}

/** Famille de couleur (classe CSS `teinte-…`) : vert = rentre, rouge = sort, ambre = à surveiller. */
export const TEINTE: Record<Genre, 'vert' | 'rouge' | 'ambre' | 'terre' | 'bleu' | 'neutre'> = {
  vente: 'vert',
  paiement: 'vert',
  depense: 'rouge',
  ponte: 'ambre',
  stock: 'ambre',
  credit: 'ambre',
  aPayer: 'ambre',
  alerte: 'ambre',
  bande: 'terre',
  fournisseur: 'terre',
  client: 'bleu',
  reglages: 'neutre',
  export: 'neutre',
  corbeille: 'neutre',
  historique: 'neutre',
  rapports: 'neutre',
}

export const NAV = { accueil: IconHome, saisir: IconCirclePlus, plus: IconDots }

/** Tailles et trait constants : 24 px dans les cartes, 20 px dans les lignes. */
export const TAILLE = { carte: 24, ligne: 20, bouton: 20 }
export const TRAIT = 1.75
