import { ajouter, rejouer, enAttente, lister, vider, listerRejetees, reessayer, abandonner, estPermanente } from '../../src/data/fileAttente'
import type { Operation } from '../../src/data/fileAttente'

const op = (id: string, nom = id): Operation => ({ id, table: 'clients', action: 'upsert', ligne: { id, nom } })

beforeEach(() => vider())

describe('fileAttente', () => {
  it('garde l’opération quand l’envoi échoue', async () => {
    await ajouter(op('a'))
    expect(await rejouer(() => Promise.reject(new Error('réseau')))).toEqual({ envoyees: 0, restantes: 1 })
    expect(await enAttente()).toBe(1)
  })
  it('remplace une opération de même id au lieu de la dupliquer', async () => {
    await ajouter(op('a', 'Dame'))
    await ajouter(op('a', 'Dame Ndiaye'))
    expect((await lister()).map((o) => o.ligne.nom)).toEqual(['Dame Ndiaye'])
  })
  it('garde la place d’origine d’une opération remplacée (un client passe avant la vente qui l’utilise)', async () => {
    await ajouter(op('client', 'Maguette'))
    await ajouter({ id: 'vente', table: 'transactions', action: 'upsert', ligne: { id: 'v', client_id: 'client' } })
    await ajouter(op('client', 'Maguette Diop'))
    expect((await lister()).map((o) => o.id)).toEqual(['client', 'vente'])
    expect((await lister())[0].ligne.nom).toBe('Maguette Diop')
  })
  it('envoie dans l’ordre d’arrivée et s’arrête au premier échec', async () => {
    await ajouter(op('a'))
    await ajouter(op('b'))
    await ajouter(op('c'))
    const vus: string[] = []
    const r = await rejouer(async (o) => {
      if (o.id === 'b') throw new Error('réseau')
      vus.push(o.id)
    })
    expect(vus).toEqual(['a'])
    expect(r).toEqual({ envoyees: 1, restantes: 2 })
    expect((await lister()).map((o) => o.id)).toEqual(['b', 'c'])
  })
  it('met de côté une opération refusée définitivement et continue avec les suivantes', async () => {
    await ajouter(op('a'))
    await ajouter(op('b'))
    const r = await rejouer(async (o) => {
      if (o.id === 'a') throw Object.assign(new Error('duplicate key'), { code: '23505' })
    })
    expect(r).toEqual({ envoyees: 1, restantes: 0 })
    expect((await listerRejetees()).map((x) => [x.op.id, x.erreur])).toEqual([['a', 'duplicate key']])
  })
  it('remet en file ou abandonne une opération refusée', async () => {
    await ajouter(op('a'))
    await rejouer(() => Promise.reject(Object.assign(new Error('x'), { code: '23503' })))
    await reessayer('a')
    expect((await lister()).map((o) => o.id)).toEqual(['a'])
    await rejouer(() => Promise.reject(Object.assign(new Error('x'), { code: '23503' })))
    await abandonner('a')
    expect(await listerRejetees()).toEqual([])
    expect(await enAttente()).toBe(0)
  })
  it('distingue erreurs définitives (contraintes, droits) et passagères (réseau)', () => {
    expect(estPermanente({ code: '23505' })).toBe(true)
    expect(estPermanente({ code: '23514' })).toBe(true)
    expect(estPermanente({ code: '42501' })).toBe(true)
    expect(estPermanente({ code: '22P02' })).toBe(true)
    expect(estPermanente(new TypeError('Failed to fetch'))).toBe(false)
    expect(estPermanente({ code: '503' })).toBe(false)
  })
  it('n’efface pas une version plus récente arrivée pendant l’envoi', async () => {
    await ajouter(op('a', 'Dame'))
    await rejouer(async () => {
      await ajouter(op('a', 'Dame Ndiaye'))
    })
    expect((await lister()).map((o) => o.ligne.nom)).toEqual(['Dame Ndiaye'])
  })
  it('laisse ajouter pendant un envoi lent (pas de blocage de la saisie)', async () => {
    await ajouter(op('a'))
    let debloquer!: () => void
    const envoi = rejouer(() => new Promise<void>((r) => { debloquer = r }))
    await new Promise((r) => setTimeout(r, 0))
    await ajouter(op('b'))
    expect((await lister()).map((o) => o.id)).toEqual(['a', 'b'])
    debloquer()
    await envoi
  })
  it('vide la file quand tout est envoyé', async () => {
    await ajouter(op('a'))
    expect(await rejouer(async () => {})).toEqual({ envoyees: 1, restantes: 0 })
    expect(await enAttente()).toBe(0)
  })
})
