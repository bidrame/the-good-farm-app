import { sauverInstantane, lireInstantane } from '../../src/data/instantane'

describe('instantané hors ligne', () => {
  it('garde les dernières données reçues pour un démarrage sans réseau', async () => {
    expect(await lireInstantane()).toBeNull()
    await sauverInstantane({ clients: [{ id: 'c', nom: 'Dame' }] })
    expect(await lireInstantane()).toEqual({ clients: [{ id: 'c', nom: 'Dame' }] })
  })
})
