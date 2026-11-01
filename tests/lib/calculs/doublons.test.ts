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

describe('Personnes semblables à l’ajout', () => {
  const gens = [
    { id: 'a', nom: 'Moussa Diop', telephone: '+221 77 123 45 67' },
    { id: 'b', nom: 'Mame-Diarra' },
    { id: 'c', nom: 'Cheikh' },
    { id: 'd', nom: 'Ancien', supprime_le: '2026-01-01' },
  ]
  it('bloque le même nom, même écrit autrement', async () => {
    const { personnesSemblables } = await import('../../../src/lib/calculs/doublons')
    expect(personnesSemblables('mame diarra', null, gens).identique?.id).toBe('b')
    expect(personnesSemblables('MOUSSA  DIOP', null, gens).identique?.id).toBe('a')
  })
  it('bloque un numéro déjà enregistré, quel que soit le format', async () => {
    const { personnesSemblables } = await import('../../../src/lib/calculs/doublons')
    expect(personnesSemblables('Autre nom', '77 123 45 67', gens).memeNumero?.id).toBe('a')
  })
  it('signale les noms proches : faute de frappe, nom complet ou abrégé', async () => {
    const { personnesSemblables } = await import('../../../src/lib/calculs/doublons')
    expect(personnesSemblables('Mousa Diop', null, gens).proches.map((p) => p.id)).toEqual(['a'])
    expect(personnesSemblables('Cheikh Fall', null, gens).proches.map((p) => p.id)).toEqual(['c'])
    expect(personnesSemblables('Ibrahima', null, gens)).toEqual({ identique: undefined, memeNumero: undefined, proches: [] })
    expect(personnesSemblables('Ancien', null, gens).identique).toBeUndefined()
  })
})
