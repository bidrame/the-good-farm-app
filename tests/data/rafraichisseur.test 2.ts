import { creerRafraichisseur } from '../../src/data/rafraichisseur'

const attendre = () => new Promise((r) => setTimeout(r, 0))

describe('creerRafraichisseur', () => {
  it('regroupe les demandes : un chargement en cours, au plus un en attente', async () => {
    const resolutions: ((v: number) => void)[] = []
    const charger = vi.fn(() => new Promise<number>((r) => resolutions.push(r)))
    const appliques: number[] = []
    const rafraichir = creerRafraichisseur(charger, (v) => appliques.push(v))
    void rafraichir()
    void rafraichir()
    void rafraichir()
    expect(charger).toHaveBeenCalledTimes(1)
    resolutions[0](1)
    await attendre()
    expect(charger).toHaveBeenCalledTimes(2)
    resolutions[1](2)
    await attendre()
    expect(appliques).toEqual([1, 2])
  })
})
