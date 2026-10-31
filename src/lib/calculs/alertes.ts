import { ajouterJours, formatDate, joursEntre } from '../format'
import type { Bande, DateISO, Ponte, Seuils } from '../types'
import { ageSemaines, bandesEnProduction, effectifPresent } from './bandes'
import { tauxPonte } from './ponte'

export type Alerte = { niveau: 'info' | 'attention' | 'danger'; code: string; message: string; bande_id?: string }

export const SEUILS_DEFAUT: Seuils = { baisse_points: 10, mortalite_pour_mille: 5, jours_sauvegarde: 7 }
export const HEURE_RAPPEL_PONTE = 18
export const SEMAINES_ALERTE_REFORME = 60
export const SEMAINES_REFORME = 72

type Contexte = { ref: DateISO; heure: number; bandes: Bande[]; pontes: Ponte[]; derniereSauvegarde: DateISO | null; seuils?: Partial<Seuils> | null }

const ORDRE = { danger: 0, attention: 1, info: 2 }

export function tauxMoyen(b: Bande, pontes: Ponte[], du: DateISO, au: DateISO): number | null {
  const jours = pontes.filter((p) => p.bande_id === b.id && !p.supprime_le && p.date >= du && p.date <= au)
  if (jours.length === 0) return null
  return jours.reduce((s, p) => s + tauxPonte(p.oeufs_collectes, effectifPresent(b, pontes, p.date)), 0) / jours.length
}

export function calculerAlertes({ ref, heure, bandes, pontes, derniereSauvegarde, seuils }: Contexte): Alerte[] {
  const s = { ...SEUILS_DEFAUT, ...seuils }
  const alertes: Alerte[] = []
  const enProd = bandesEnProduction(bandes, pontes, ref)
  const pontesVivantes = pontes.filter((p) => !p.supprime_le)

  const manquantes = enProd.filter((b) => !pontesVivantes.some((p) => p.bande_id === b.id && p.date === ref))
  if (heure >= HEURE_RAPPEL_PONTE && manquantes.length > 0)
    alertes.push({ niveau: 'danger', code: 'ponte_non_saisie', message: `Ponte du jour pas encore saisie (${manquantes.map((b) => b.nom).join(', ')})` })

  for (const b of enProd) {
    const recent = tauxMoyen(b, pontes, ajouterJours(ref, -7), ajouterJours(ref, -1))
    const avant = tauxMoyen(b, pontes, ajouterJours(ref, -14), ajouterJours(ref, -8))
    if (recent != null && avant != null && avant - recent > s.baisse_points / 100)
      alertes.push({
        niveau: 'attention', code: 'ponte_en_baisse', bande_id: b.id,
        message: `${b.nom} : ponte en baisse (${Math.round(avant * 100)} % → ${Math.round(recent * 100)} % sur 7 jours)`,
      })

    for (const date of [ref, ajouterJours(ref, -1)]) {
      const p = pontesVivantes.find((x) => x.bande_id === b.id && x.date === date)
      const effectif = effectifPresent(b, pontes, date)
      if (p && effectif > 0 && p.mortalite / effectif > s.mortalite_pour_mille / 1000) {
        alertes.push({ niveau: 'attention', code: 'mortalite', bande_id: b.id, message: `${b.nom} : ${p.mortalite} morts le ${formatDate(date)}` })
        break
      }
    }
  }

  for (const b of bandes.filter((x) => !x.supprime_le && !x.date_reforme)) {
    if (ageSemaines(b, ref) < SEMAINES_ALERTE_REFORME) continue
    const reforme = ajouterJours(b.date_naissance, SEMAINES_REFORME * 7)
    alertes.push(
      reforme <= ref
        ? { niveau: 'attention', code: 'reforme_a_planifier', bande_id: b.id, message: `${b.nom} : ${SEMAINES_REFORME} semaines atteintes le ${formatDate(reforme)}, réforme à décider` }
        : {
            niveau: 'info', code: 'reforme_a_planifier', bande_id: b.id,
            message: `${b.nom} : réforme prévue le ${formatDate(reforme)}, commander les poussins avant le ${formatDate(ajouterJours(reforme, -60))}`,
          },
    )
  }

  if (!derniereSauvegarde || joursEntre(derniereSauvegarde, ref) > s.jours_sauvegarde)
    alertes.push({ niveau: 'info', code: 'sauvegarde', message: 'Pensez à exporter la sauvegarde Excel' })

  return alertes.sort((a, b) => ORDRE[a.niveau] - ORDRE[b.niveau])
}
