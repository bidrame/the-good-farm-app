import { cleNom, estDoublonTransaction } from '../../../src/lib/calculs/doublons'
import { tx } from '../../fixtures/tx'

describe('cleNom', () => {
  it('ignore la casse, les accents et les espaces en trop', () => {
    expect(cleNom('  ABABACAR ')).toBe(cleNom('ababacar'))
    expect(cleNom('Koné')).toBe(cleNom('kone'))
    expect(cleNom('Babacar   sicap M')).toBe(cleNom('babacar sicap m'))
  })
  it('distingue des clients différents', () => {
    expect(cleNom('Babacar')).not.toBe(cleNom('Babacar sicap M'))
  })
})

describe('estDoublonTransaction', () => {
  const t = tx({ prix_unitaire: 52000 })
  it('reconnaît la même vente le même jour', () => {
    expect(estDoublonTransaction({ ...t, id: 'nouveau' }, [t])).toBe(true)
  })
  it('ne se compare pas à elle-même (modification)', () => {
    expect(estDoublonTransaction(t, [t])).toBe(false)
  })
  it('ignore une ligne supprimée ou un montant différent', () => {
    expect(estDoublonTransaction({ ...t, id: 'n' }, [{ ...t, supprime_le: '2026-10-31' }])).toBe(false)
    expect(estDoublonTransaction({ ...t, id: 'n', montant: 1 }, [t])).toBe(false)
  })
})
