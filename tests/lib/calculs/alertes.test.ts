import { calculerAlertes } from '../../../src/lib/calculs/alertes'
import { ajouterJours } from '../../../src/lib/format'
import { BANDES, ponte } from '../../fixtures/bandes'
import type { Bande, Ponte } from '../../../src/lib/types'

const REF = '2026-10-31'
const b4: Bande = { ...BANDES[3], date_naissance: '2026-01-01', effectif_initial: 600 } // 43 semaines : pas d'alerte de réforme
const codes = (a: { code: string }[]) => a.map((x) => x.code)

/** 14 jours de ponte de b4 jusqu'à hier : 7 premiers jours à `avant`, 7 derniers à `apres`. */
function historique(avant: number, apres: number): Ponte[] {
  return Array.from({ length: 14 }, (_, i) => {
    const date = ajouterJours(REF, i - 14)
    return ponte('b4', date, { oeufs_collectes: Math.round(600 * (i < 7 ? avant : apres)) })
  })
}

/** 7 jours à `normale` œufs puis la veille de REF à `dernier`. */
function chute(normale: number, dernier: number): Ponte[] {
  return Array.from({ length: 8 }, (_, i) => ponte('b4', ajouterJours(REF, i - 8), { oeufs_collectes: i < 7 ? normale : dernier }))
}

const base = { ref: REF, heure: 10, bandes: [b4], pontes: historique(0.83, 0.83), derniereSauvegarde: REF }

describe('calculerAlertes', () => {
  it("ne signale rien quand tout va bien", () => {
    expect(calculerAlertes(base)).toEqual([])
  })
  it("signale la ponte du jour non saisie après 18 h seulement", () => {
    expect(codes(calculerAlertes({ ...base, heure: 19 }))).toContain('ponte_non_saisie')
    expect(codes(calculerAlertes({ ...base, heure: 10 }))).not.toContain('ponte_non_saisie')
    const avecJour = [...base.pontes, ponte('b4', REF, { oeufs_collectes: 500 })]
    expect(codes(calculerAlertes({ ...base, heure: 19, pontes: avecJour }))).not.toContain('ponte_non_saisie')
  })
  it('signale une baisse des œufs de plus de 15 % par rapport à la moyenne de la bande', () => {
    const a = calculerAlertes({ ...base, pontes: chute(500, 400) })
    expect(codes(a)).toEqual(['ponte_en_baisse'])
    expect(a[0].bande_id).toBe('b4')
    expect(a[0].message).toBe('BANDE 4 : 400 œufs le 30/10, −20 % par rapport à sa moyenne de 7 jours (500)')
    expect(codes(calculerAlertes({ ...base, pontes: chute(500, 440) }))).toEqual([])
  })
  it('ne dépend pas de l’effectif (mortalité mal notée)', () => {
    const p = chute(500, 400).map((x) => ({ ...x, mortalite: 0 }))
    expect(codes(calculerAlertes({ ...base, bandes: [{ ...b4, effectif_initial: 99999 }], pontes: p }))).toEqual(['ponte_en_baisse'])
  })
  it('signale une mortalité au-dessus de 0,5 % de l’effectif (hier ou aujourd’hui)', () => {
    const p = [...base.pontes.slice(0, -1), { ...base.pontes[13], mortalite: 4 }]
    expect(codes(calculerAlertes({ ...base, pontes: p }))).toEqual(['mortalite'])
    const p2 = [...base.pontes.slice(0, -1), { ...base.pontes[13], mortalite: 2 }]
    expect(codes(calculerAlertes({ ...base, pontes: p2 }))).toEqual([])
  })
  it('annonce la réforme à planifier dès 60 semaines', () => {
    const b = { ...BANDES[3] } // née le 13/08/2025 : 63 semaines, 72 semaines le 30/12/2026
    const r = calculerAlertes({ ...base, bandes: [b], pontes: [] }).find((x) => x.code === 'reforme_a_planifier')
    expect(r?.bande_id).toBe('b4')
    expect(r?.niveau).toBe('info')
    expect(r?.message).toBe('BANDE 4 : réforme prévue le 30/12/2026, commander les poussins avant le 31/10/2026')
  })
  it('dit clairement quand les 72 semaines sont dépassées', () => {
    const r = calculerAlertes({ ...base, bandes: [{ ...BANDES[2] }], pontes: [] }).find((x) => x.code === 'reforme_a_planifier')
    expect(r?.message).toBe('BANDE 3 : 72 semaines atteintes le 10/06/2026, réforme à décider')
    expect(r?.niveau).toBe('attention')
  })
  it('utilise les seuils réglés par l’utilisateur', () => {
    const seuils = { baisse_pct: 25, mortalite_pour_mille: 5, jours_sauvegarde: 3 }
    expect(codes(calculerAlertes({ ...base, pontes: chute(500, 400), seuils }))).toEqual([])
    expect(codes(calculerAlertes({ ...base, derniereSauvegarde: '2026-10-27', seuils }))).toEqual(['sauvegarde'])
  })
  it('rappelle la sauvegarde au-delà de 7 jours', () => {
    expect(codes(calculerAlertes({ ...base, derniereSauvegarde: '2026-10-23' }))).toEqual(['sauvegarde'])
    expect(codes(calculerAlertes({ ...base, derniereSauvegarde: null }))).toEqual(['sauvegarde'])
    expect(codes(calculerAlertes({ ...base, derniereSauvegarde: '2026-10-25' }))).toEqual([])
  })
  it('classe les alertes danger, puis attention, puis info', () => {
    const a = calculerAlertes({ ...base, heure: 19, derniereSauvegarde: null, pontes: chute(500, 300) })
    expect(a.map((x) => x.niveau)).toEqual(['danger', 'attention', 'info'])
  })
})
