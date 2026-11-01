import { OEUFS_PAR_PLATEAU } from '../lib/calculs/oeufs'

/**
 * « Corriger » une saisie refusée par le serveur : on la remet en brouillon dans son formulaire,
 * puis on renvoie l'adresse de ce formulaire. `null` : pas de formulaire pour ce genre de saisie.
 */
export function remettreEnBrouillon(table: string, l: Record<string, unknown>): string | null {
  const nombre = (v: unknown) => (typeof v === 'number' ? v : null)
  const texte = (v: unknown) => (typeof v === 'string' ? v : '')
  if (table === 'transactions') {
    const montant = nombre(l.montant) ?? 0
    const paye = nombre(l.montant_paye) ?? 0
    sessionStorage.setItem('brouillon-saisie', JSON.stringify({
      // Nouvel id : l'ancien a été refusé, on repart d'une saisie neuve.
      id: crypto.randomUUID(), type: l.type === 'depense' ? 'depense' : 'vente', date: texte(l.date),
      client_id: l.client_id ?? null, produit_id: l.produit_id ?? null, quantite: nombre(l.quantite), prix_unitaire: nombre(l.prix_unitaire),
      oeufs_par_unite: nombre(l.oeufs_par_unite) ?? OEUFS_PAR_PLATEAU, calibre: l.calibre ?? null,
      paye: paye >= montant ? 'tout' : paye <= 0 ? 'rien' : 'partie', montant_paye: paye > 0 && paye < montant ? paye : null,
      observation: texte(l.observation),
    }))
    return '/saisir'
  }
  if (table === 'ponte' && typeof l.date === 'string' && typeof l.bande_id === 'string') {
    const cle = `brouillon-ponte-${l.date}`
    let brouillon: Record<string, unknown> = {}
    try {
      brouillon = JSON.parse(sessionStorage.getItem(cle) ?? '{}')
    } catch {
      /* brouillon illisible : on repart de zéro */
    }
    brouillon[l.bande_id] = {
      // Même id : une seule ponte par bande et par jour.
      id: l.id, oeufs: nombre(l.oeufs_collectes), perdus: nombre(l.oeufs_perdus), morts: nombre(l.mortalite), aliment: nombre(l.aliment_kg), observation: texte(l.observation),
    }
    sessionStorage.setItem(cle, JSON.stringify(brouillon))
    return `/ponte?date=${l.date}`
  }
  return null
}
