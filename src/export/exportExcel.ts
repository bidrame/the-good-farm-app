import { nomCalibre } from '../lib/calculs/calibres'
import * as XLSX from 'xlsx'
import type { Donnees } from '../data/useDonnees'
import { boxesFerme, ouvrierDuBox } from '../lib/calculs/boxes'
import { fiabiliteEffectif } from '../lib/calculs/effectifs'
import { LIBELLE_PHASE, ageSemaines, effectifActuel, effectifPresent, phase } from '../lib/calculs/bandes'
import { bilanMensuel } from '../lib/calculs/bilans'
import { soldesClients } from '../lib/calculs/credits'
import { dettesFournisseurs } from '../lib/calculs/dettes'
import { OEUFS_PAR_PLATEAU, estProduitOeufs } from '../lib/calculs/oeufs'
import { tauxPonte } from '../lib/calculs/ponte'
import type { DateISO } from '../lib/types'

/** Date Excel : minuit local, pour que la cellule affiche le bon jour. */
const dateExcel = (d: DateISO | null | undefined) => {
  if (!d) return null
  const [a, m, j] = d.split('-').map(Number)
  return new Date(a, m - 1, j)
}

const FORMAT_DATE = 'dd/mm/yyyy'

function feuille(lignes: Record<string, unknown>[], entetes: string[]): XLSX.WorkSheet {
  const ws = XLSX.utils.json_to_sheet(lignes, { header: entetes, cellDates: true, dateNF: FORMAT_DATE })
  ws['!cols'] = entetes.map((e) => ({ wch: Math.max(10, e.length + 2) }))
  return ws
}

export function nomFichier(d: DateISO): string {
  return `TheGoodFarm_${d}.xlsx`
}

export function construireClasseur(d: Donnees, ref: DateISO): XLSX.WorkBook {
  const nom = <T extends { id: string; nom: string }>(liste: T[], id: string | null) => liste.find((x) => x.id === id)?.nom ?? ''
  const auteur = (uid?: string) => (uid ? d.profils.find((p) => p.id === uid)?.prenom ?? '' : 'Import')
  const txs = d.transactions.filter((t) => !t.supprime_le).sort((a, b) => b.date.localeCompare(a.date))
  const wb = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(wb, feuille(txs.map((t) => ({
    Date: dateExcel(t.date),
    Type: t.type === 'vente' ? 'Vente' : 'Dépense',
    Client: nom(d.clients, t.client_id),
    Produit: nom(d.produits, t.produit_id),
    'Prix unitaire': t.prix_unitaire,
    Quantité: t.quantite,
    'Œufs par unité': t.type === 'vente' && estProduitOeufs(d.produits.find((p) => p.id === t.produit_id)) ? t.oeufs_par_unite ?? OEUFS_PAR_PLATEAU : null,
    Calibre: t.calibre ? nomCalibre(t.calibre) : '',
    Montant: t.type === 'vente' ? t.montant : -t.montant,
    'Montant payé': t.type === 'vente' ? t.montant_paye : null,
    Reste: t.type === 'vente' ? t.montant - t.montant_paye : null,
    Observation: t.observation ?? '',
    'Saisi par': auteur(t.cree_par),
  })), ['Date', 'Type', 'Client', 'Produit', 'Prix unitaire', 'Quantité', 'Œufs par unité', 'Calibre', 'Montant', 'Montant payé', 'Reste', 'Observation', 'Saisi par']), 'Transactions')

  XLSX.utils.book_append_sheet(wb, feuille(d.paiements.filter((p) => !p.supprime_le).sort((a, b) => b.date.localeCompare(a.date)).map((p) => ({
    Date: dateExcel(p.date), Sens: p.sens === 'fournisseur' ? 'Fournisseur' : 'Client', Nom: nom(d.clients, p.client_id),
    Montant: p.montant, Mode: p.mode, Observation: p.observation ?? '',
  })), ['Date', 'Sens', 'Nom', 'Montant', 'Mode', 'Observation']), 'Paiements')

  XLSX.utils.book_append_sheet(wb, feuille(soldesClients(d.clients, d.transactions, d.paiements).map((s) => ({
    Client: s.client.nom, Solde: s.solde,
  })), ['Client', 'Solde']), 'Crédits clients')

  XLSX.utils.book_append_sheet(wb, feuille(dettesFournisseurs(d.clients, d.transactions, d.paiements, ref).lignes.map((l) => ({
    Fournisseur: l.fournisseur.nom, 'Reste à payer': l.du, 'Depuis le': dateExcel(l.depuis), Jours: l.jours,
  })), ['Fournisseur', 'Reste à payer', 'Depuis le', 'Jours']), 'Dettes fournisseurs')

  const boxes = boxesFerme(d.reglages[0], d.bandes)
  XLSX.utils.book_append_sheet(wb, feuille(d.bandes.filter((b) => !b.supprime_le).sort((a, b) => a.nom.localeCompare(b.nom)).map((b) => {
    const f = fiabiliteEffectif(b, { pontes: d.ponte, recensements: d.recensements, mortalites: d.mortalites }, ref, d.reglages[0]?.courbe_attendue)
    return {
      Bande: b.nom, Box: b.box, 'Née le': dateExcel(b.date_naissance), 'Effectif initial': b.effectif_initial,
      'Effectif actuel': effectifActuel(b, d.ponte, undefined, d.recensements, d.mortalites), 'Effectif vérifié': f.verifie ? 'oui' : 'non',
      'Estimé d’après la ponte': b.date_reforme ? null : f.estime, 'Âge (sem)': ageSemaines(b, ref),
      Phase: b.date_reforme ? 'Réformée' : LIBELLE_PHASE[phase(ageSemaines(b, ref))], 'Réformée le': dateExcel(b.date_reforme),
      Ouvrier: nom(d.ouvriers, b.date_reforme ? b.ouvrier_id : ouvrierDuBox(boxes, b.box)),
    }
  }), ['Bande', 'Box', 'Née le', 'Effectif initial', 'Effectif actuel', 'Effectif vérifié', 'Estimé d’après la ponte', 'Âge (sem)', 'Phase', 'Réformée le', 'Ouvrier']), 'Bandes')

  XLSX.utils.book_append_sheet(wb, feuille(d.ponte.filter((p) => !p.supprime_le).sort((a, b) => b.date.localeCompare(a.date)).map((p) => {
    const b = d.bandes.find((x) => x.id === p.bande_id)
    return {
      Date: dateExcel(p.date), Bande: b?.nom ?? '', 'Œufs collectés': p.oeufs_collectes, 'Œufs perdus': p.oeufs_perdus,
      Mortalité: p.mortalite, 'Aliment (kg)': p.aliment_kg, 'Taux de ponte': b ? Math.round(tauxPonte(p.oeufs_collectes, effectifPresent(b, d.ponte, p.date, d.recensements, d.mortalites)) * 1000) / 1000 : null,
      Observation: p.observation ?? '',
    }
  }), ['Date', 'Bande', 'Œufs collectés', 'Œufs perdus', 'Mortalité', 'Aliment (kg)', 'Taux de ponte', 'Observation']), 'Ponte')

  XLSX.utils.book_append_sheet(wb, feuille(d.mortalites.filter((m) => !m.supprime_le).sort((a, b) => b.date.localeCompare(a.date)).map((m) => ({
    Date: dateExcel(m.date), Bande: nom(d.bandes, m.bande_id), Morts: m.nombre, Observation: m.observation ?? '',
  })), ['Date', 'Bande', 'Morts', 'Observation']), 'Mortalités')

  XLSX.utils.book_append_sheet(wb, feuille(d.ramassages.filter((r) => !r.supprime_le).sort((a, b) => b.date.localeCompare(a.date)).flatMap((r) =>
    r.lignes.map((l) => ({
      Date: dateExcel(r.date), Du: dateExcel(r.du), Box: l.numero || 'magasin', Calibre: l.calibre ? nomCalibre(l.calibre) : '',
      'Œufs attendus': l.theorique, 'Œufs chargés': l.charge, 'Dont du matin': l.matin ?? 0, Écart: l.charge - (l.matin ?? 0) - l.theorique,
      Observation: r.observation ?? '',
    }))), ['Date', 'Du', 'Box', 'Calibre', 'Œufs attendus', 'Œufs chargés', 'Dont du matin', 'Écart', 'Observation']), 'Livraisons')

  XLSX.utils.book_append_sheet(wb, feuille(bilanMensuel(d.transactions).map((l) => ({
    Mois: l.periode, Ventes: l.ventes, Dépenses: l.depenses, Résultat: l.resultat, Cumul: l.cumul,
  })), ['Mois', 'Ventes', 'Dépenses', 'Résultat', 'Cumul']), 'Bilan mensuel')

  return wb
}

export function fichierExcel(d: Donnees, ref: DateISO): File {
  const octets = XLSX.write(construireClasseur(d, ref), { type: 'array', bookType: 'xlsx' })
  return new File([octets], nomFichier(ref), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
