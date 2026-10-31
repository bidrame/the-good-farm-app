import { lienRappel } from '../../src/lib/whatsapp'

const message = 'Bonjour Dame, votre solde à The Good Farm est de 22 000 FCFA. Merci.'

describe('lienRappel', () => {
  it('ajoute l’indicatif du Sénégal à un numéro local', () => {
    const l = lienRappel('Dame', 22000, '77 123 45 67')
    expect(l.startsWith('https://wa.me/221771234567?text=')).toBe(true)
    expect(decodeURIComponent(l.split('text=')[1]).replace(/\s/g, ' ')).toBe(message)
  })
  it('garde un numéro déjà international', () => {
    expect(lienRappel('Dame', 22000, '+221 77 123 45 67')).toMatch(/^https:\/\/wa\.me\/221771234567\?/)
  })
  it('laisse choisir le contact sans numéro', () => {
    expect(lienRappel('Dame', 22000)).toMatch(/^https:\/\/wa\.me\/\?text=/)
  })
})
