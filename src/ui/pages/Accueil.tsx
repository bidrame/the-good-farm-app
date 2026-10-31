import { Link } from 'react-router-dom'
import { useDonnees } from '../../data/useDonnees'
import { calculerAlertes } from '../../lib/calculs/alertes'
import { ageSemaines, bandesEnProduction, effectifPresent } from '../../lib/calculs/bandes'
import { bilanMensuel } from '../../lib/calculs/bilans'
import { couleurTaux } from '../../lib/calculs/couleur'
import { soldesClients } from '../../lib/calculs/credits'
import { oeufsEnPlaques, tauxAttendu, tauxPonte } from '../../lib/calculs/ponte'
import { ajouterJours, aujourdhui, formatFCFA } from '../../lib/format'
import { Alerte, CarteMetrique } from '../composants/communs'

const NOMS_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

function variation(actuel: number, precedent: number | undefined): number | null {
  return precedent ? (actuel - precedent) / precedent : null
}

function moisPrecedent(periode: string): string {
  const [a, m] = periode.split('-').map(Number)
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`
}

export function Accueil() {
  const { transactions, paiements, clients, bandes, ponte, reglages, enAttente } = useDonnees()
  const ref = aujourdhui()
  const hier = ajouterJours(ref, -1)
  const courbe = reglages[0]?.courbe_attendue ?? undefined

  const mois = ref.slice(0, 7)
  const bilan = bilanMensuel(transactions)
  const ce = bilan.find((l) => l.periode === mois) ?? { ventes: 0, depenses: 0, resultat: 0 }
  const avant = bilan.find((l) => l.periode === moisPrecedent(mois))
  const credits = soldesClients(clients, transactions, paiements).filter((s) => s.solde > 0).reduce((t, s) => t + s.solde, 0)

  const enProd = bandesEnProduction(bandes, ponte, ref)
  const ponteHier = enProd.map((b) => {
    const p = ponte.find((x) => x.bande_id === b.id && x.date === hier && !x.supprime_le)
    const taux = p ? tauxPonte(p.oeufs_collectes, effectifPresent(b, ponte, hier)) : null
    return { b, p, taux, attendu: tauxAttendu(ageSemaines(b, hier), courbe) }
  })
  const totalHier = oeufsEnPlaques(ponteHier.reduce((s, x) => s + (x.p?.oeufs_collectes ?? 0), 0))

  const alertes = calculerAlertes({ ref, heure: new Date().getHours(), bandes, pontes: ponte, derniereSauvegarde: reglages[0]?.derniere_sauvegarde ?? null, seuils: reglages[0]?.seuils })

  return (
    <main>
      <h1>The Good Farm · {NOMS_MOIS[Number(mois.slice(5)) - 1]}</h1>
      {enAttente > 0 && <div className="alerte attention">En attente d’envoi ({enAttente})</div>}
      {alertes.map((a, i) => <Alerte key={i} alerte={a} />)}

      <div className="grille2" style={{ margin: '10px 0' }}>
        <CarteMetrique libelle="Ventes" valeur={formatFCFA(ce.ventes)} variation={variation(ce.ventes, avant?.ventes)} />
        <CarteMetrique libelle="Dépenses" valeur={formatFCFA(ce.depenses)} variation={variation(ce.depenses, avant?.depenses)} hausseMauvaise />
        <CarteMetrique libelle="Résultat" valeur={formatFCFA(ce.resultat)} />
        <Link to="/clients" style={{ color: 'inherit', textDecoration: 'none' }}>
          <CarteMetrique libelle="Crédits dus" valeur={formatFCFA(credits)} />
        </Link>
      </div>

      <section aria-label="Ponte d’hier" className="carte">
        <h2 style={{ marginTop: 0 }}>Ponte d’hier</h2>
        {ponteHier.map(({ b, taux, attendu }) => (
          <div className="ligne" key={b.id}>
            <span>{b.nom} <span className="discret">box {b.box}</span></span>
            {taux == null ? <span className="discret">non saisie</span> : <strong className={couleurTaux(taux, attendu)}>{Math.round(taux * 100)} %</strong>}
          </div>
        ))}
        <div className="ligne">
          <span>Ferme</span>
          <strong>{totalHier.plaques} plaques + {totalHier.restants}</strong>
        </div>
      </section>
    </main>
  )
}
