import { formatFCFA } from './format'

const INDICATIF = '221'

/** Lien WhatsApp avec un message de rappel de solde, prêt à envoyer par l'utilisateur. */
export function lienRappel(nom: string, solde: number, telephone?: string | null): string {
  const montant = formatFCFA(solde).replace(/ F$/, ' FCFA')
  const texte = encodeURIComponent(`Bonjour ${nom}, votre solde à The Good Farm est de ${montant}. Merci.`)
  let num = (telephone ?? '').replace(/\D/g, '')
  if (num && !num.startsWith(INDICATIF)) num = INDICATIF + num
  return `https://wa.me/${num}?text=${texte}`
}
