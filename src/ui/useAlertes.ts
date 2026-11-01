import { useState } from 'react'
import { useDonnees } from '../data/useDonnees'
import { calculerAlertes, type Alerte } from '../lib/calculs/alertes'
import { etatAliment, JOURS_ALERTE_ALIMENT } from '../lib/calculs/aliment'
import { bandesEnProduction } from '../lib/calculs/bandes'
import { dettesFournisseurs } from '../lib/calculs/dettes'
import { fiabiliteEffectif } from '../lib/calculs/effectifs'
import { ajouterJours, aujourdhui } from '../lib/format'

export type AlerteAction = Alerte & { cle: string; action: { libelle: string; vers: string } | null }

const CLE_STOCKAGE = 'alertes-vues'
const ORDRE = { danger: 0, attention: 1, info: 2 }

/** Une alerte vue revient si son message change (la situation a bougé, par exemple la dette a vieilli). */
const cleDe = (a: Alerte) => `${a.code}|${a.bande_id ?? ''}|${a.message}`

function actionDe(a: Alerte): AlerteAction['action'] {
  switch (a.code) {
    case 'ponte_non_saisie': return { libelle: 'Saisir la ponte', vers: '/ponte' }
    case 'effectif_a_verifier': return a.bande_id ? { libelle: 'Recompter', vers: `/bandes/${a.bande_id}` } : null
    case 'ponte_en_baisse': case 'mortalite': case 'reforme_a_planifier': return a.bande_id ? { libelle: 'Voir la bande', vers: `/bandes/${a.bande_id}` } : null
    case 'dette_ancienne': return { libelle: 'Voir la dette', vers: '/fournisseurs' }
    case 'sauvegarde': return { libelle: 'Exporter', vers: '/export' }
    case 'aliment_bas': return { libelle: 'Voir l’aliment', vers: '/aliment' }
    default: return null
  }
}

function lireVues(): string[] {
  try { return JSON.parse(localStorage.getItem(CLE_STOCKAGE) ?? '[]') as string[] } catch { return [] }
}

/** Toutes les alertes du jour, triées par gravité, avec celles marquées « Vu » sur ce téléphone. */
export function useAlertes() {
  const { transactions, paiements, clients, produits, bandes, ponte, recensements, mortalites, reglages } = useDonnees()
  const [vues, setVues] = useState<string[]>(lireVues)
  const ref = aujourdhui()
  const r = reglages[0]
  const dettes = dettesFournisseurs(clients, transactions, paiements, ref)
  const brutes = calculerAlertes({ ref, heure: new Date().getHours(), bandes, pontes: ponte, derniereSauvegarde: r?.derniere_sauvegarde ?? null, seuils: r?.seuils, dettes: dettes.lignes })
  const aVerifier = bandesEnProduction(bandes, ponte, ref)
    .filter((b) => fiabiliteEffectif(b, { pontes: ponte, recensements, mortalites }, ajouterJours(ref, -1), r?.courbe_attendue).incoherent)
  if (aVerifier.length)
    brutes.push({
      niveau: 'attention', code: 'effectif_a_verifier', bande_id: aVerifier[0].id,
      message: `Effectif à vérifier : ${aVerifier.map((b) => b.nom).join(', ')}. La ponte ne correspond pas au nombre de poules noté ; recomptez pour des taux fiables`,
    })
  const aliment = etatAliment({ transactions, pontes: ponte, produits, reglage: r?.aliment }, ref)
  if (aliment.jours != null && aliment.jours <= (r?.aliment?.jours_alerte || JOURS_ALERTE_ALIMENT))
    brutes.push({
      niveau: aliment.jours <= 2 ? 'danger' : 'attention', code: 'aliment_bas',
      message: `Aliment : il reste environ ${aliment.stockSacs} sacs, soit ${aliment.jours} jour${aliment.jours > 1 ? 's' : ''}. Pensez à commander.`,
    })
  const toutes: AlerteAction[] = brutes
    .sort((a, b) => ORDRE[a.niveau] - ORDRE[b.niveau])
    .map((a) => ({ ...a, cle: cleDe(a), action: actionDe(a) }))

  const ecrire = (l: string[]) => {
    // On ne garde que les alertes encore présentes : une situation réglée puis revenue redevient nouvelle.
    const utiles = l.filter((c) => toutes.some((a) => a.cle === c))
    setVues(utiles)
    try { localStorage.setItem(CLE_STOCKAGE, JSON.stringify(utiles)) } catch { /* stockage indisponible : l'état reste en mémoire */ }
  }
  return {
    nouvelles: toutes.filter((a) => !vues.includes(a.cle)),
    vues: toutes.filter((a) => vues.includes(a.cle)),
    total: toutes.length,
    marquerVue: (cle: string) => ecrire([...vues, cle]),
    remettre: (cle: string) => ecrire(vues.filter((c) => c !== cle)),
  }
}
