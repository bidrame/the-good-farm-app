import { envoyerOperation, chargerTout, appliquerEnAttente, preparerLigne, idOperation } from '../../src/data/repo'
import { fauxSupabase } from '../fixtures/fauxSupabase'
import { ajouter, rejouer, vider } from '../../src/data/fileAttente'

beforeEach(() => vider())

describe('envoyerOperation', () => {
  it('rejoue sans doublon quand la réponse a été perdue', async () => {
    const sb = fauxSupabase()
    let premier = true
    const envoi = async (o: Parameters<typeof envoyerOperation>[1]) => {
      await envoyerOperation(sb as never, o)
      if (premier) {
        premier = false
        throw new Error('réponse perdue')
      }
    }
    await ajouter({ id: 'upsert:clients:x', table: 'clients', action: 'upsert', ligne: { id: 'x', nom: 'Dame' } })
    await rejouer(envoi)
    await rejouer(envoi)
    expect(sb.tables.clients).toEqual([{ id: 'x', nom: 'Dame' }])
  })
  it('supprime puis restaure par la date de suppression', async () => {
    const sb = fauxSupabase({ clients: [{ id: 'x', nom: 'Dame', supprime_le: null }] })
    await envoyerOperation(sb as never, { id: '1', table: 'clients', action: 'supprimer', ligne: { id: 'x' } })
    expect(sb.tables.clients[0].supprime_le).toEqual(expect.any(String))
    await envoyerOperation(sb as never, { id: '2', table: 'clients', action: 'restaurer', ligne: { id: 'x' } })
    expect(sb.tables.clients[0].supprime_le).toBeNull()
  })
})

describe('preparerLigne', () => {
  it('donne un id et retire les champs gérés par la base', () => {
    const l = preparerLigne({ nom: 'Dame', cree_par: 'u', cree_le: 'x', modifie_le: 'y', modifie_par: 'z', supprime_le: null })
    expect(l).toEqual({ id: expect.stringMatching(/^[0-9a-f-]{36}$/), nom: 'Dame' })
  })
  it('garde l’id existant', () => {
    expect(preparerLigne({ id: 'abc', nom: 'Dame' }).id).toBe('abc')
  })
})

describe('chargerTout', () => {
  it('lit toutes les pages de 1000 lignes', async () => {
    const sb = fauxSupabase({ transactions: Array.from({ length: 2500 }, (_, i) => ({ id: String(i) })) })
    expect(await chargerTout(sb as never, 'transactions')).toHaveLength(2500)
    expect(sb.appels.map((a) => a.action)).toEqual(['order id', 'range 0-999', 'order id', 'range 1000-1999', 'order id', 'range 2000-2999'])
  })
})

describe('appliquerEnAttente', () => {
  it('montre tout de suite les saisies pas encore envoyées', () => {
    const donnees = { clients: [{ id: 'a', nom: 'Dame' }] }
    const r = appliquerEnAttente(donnees, [
      { id: '1', table: 'clients', action: 'upsert', ligne: { id: 'a', nom: 'Dame N' } },
      { id: '2', table: 'clients', action: 'upsert', ligne: { id: 'b', nom: 'Ass' } },
      { id: '3', table: 'clients', action: 'supprimer', ligne: { id: 'b' } },
    ])
    expect(r.clients).toEqual([{ id: 'a', nom: 'Dame N' }, { id: 'b', nom: 'Ass', supprime_le: expect.any(String) }])
  })
})

describe('idOperation', () => {
  it('donne le même id à supprimer et restaurer d’une ligne (le dernier état gagne)', () => {
    expect(idOperation('clients', 'supprimer', 'x')).toBe(idOperation('clients', 'restaurer', 'x'))
    expect(idOperation('clients', 'upsert', 'x')).not.toBe(idOperation('clients', 'supprimer', 'x'))
  })
})
