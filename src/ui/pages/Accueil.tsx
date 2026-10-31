import { IconCash, IconEgg, IconReceipt } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { useDonnees } from '../../data/useDonnees'
import { calculerAlertes } from '../../lib/calculs/alertes'
import { ageSemaines, bandesEnProduction, effectifPresent } from '../../lib/calculs/bandes'
import { bilanMensuel } from '../../lib/calculs/bilans'
import { couleurTaux } from '../../lib/calculs/couleur'
import { soldesClients } from '../../lib/calculs/credits'
import { OEUFS_PAR_PLATEAU, decomposer, stockOeufs } from '../../lib/calculs/oeufs'
import { tauxAttendu, tauxPonte } from '../../lib/calculs/ponte'
import { ajouterJours, aujourdhui, formatFCFA } from '../../lib/format'
import { Compteur } from '../composants/animations'
import { Alerte, CarteMetrique } from '../composants/communs'
import { Oeuf } from '../composants/Oeuf'

const NOMS_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

function variation(actuel: number, precedent: number | undefined): number | null {
  return precedent ? (actuel - precedent) / precedent : null
}

function moisPrecedent(periode: string): string {
  const [a, m] = periode.split('-').map(Number)
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`
}

const RACCOURCIS = [
  { vers: '/saisir', libelle: 'Vente', Icone: IconCash, fond: 'var(--vert)', texte: 'var(--sur-vert)' },
  { vers: '/ponte', libelle: 'Ponte', Icone: IconEgg, fond: 'var(--jaune)', texte: '#3d2a00' },
  { vers: '/saisir?type=depense', libelle: 'Dépense', Icone: IconReceipt, fond: 'var(--carte)', texte: 'var(--texte)' },
]

export function Accueil() {
  const { transactions, paiements, clients, produits, bandes, ponte, reglages, enAttente } = useDonnees()
  const ref = aujourdhui()
  const hier = ajouterJours(ref, -1)
  const r = reglages[0]
  const courbe = r?.courbe_attendue ?? undefined

  const mois = ref.slice(0, 7)
  const nomMois = NOMS_MOIS[Number(mois.slice(5)) - 1]
  const bilan = bilanMensuel(transactions)
  const ce = bilan.find((l) => l.periode === mois) ?? { ventes: 0, depenses: 0, resultat: 0 }
  const avant = bilan.find((l) => l.periode === moisPrecedent(mois))
  const credits = soldesClients(clients, transactions, paiements).filter((s) => s.solde > 0).reduce((t, s) => t + s.solde, 0)
  // Écart en francs : un pourcentage n'a pas de sens quand le résultat est négatif.
  const ecartResultat = avant ? ce.resultat - avant.resultat : null
  const nomMoisPrecedent = NOMS_MOIS[Number(moisPrecedent(mois).slice(5)) - 1]

  const enProd = bandesEnProduction(bandes, ponte, ref)
  const ponteHier = enProd.map((b) => {
    const p = ponte.find((x) => x.bande_id === b.id && x.date === hier && !x.supprime_le)
    const taux = p ? tauxPonte(p.oeufs_collectes, effectifPresent(b, ponte, hier)) : null
    return { b, p, taux, attendu: tauxAttendu(ageSemaines(b, hier), courbe) }
  })
  const totalHier = decomposer(ponteHier.reduce((s, x) => s + (x.p?.oeufs_collectes ?? 0), 0), OEUFS_PAR_PLATEAU)
  const stock = r?.stock_depart ? decomposer(Math.max(0, stockOeufs({ pontes: ponte, transactions, produits, depart: r.stock_depart })), OEUFS_PAR_PLATEAU) : null

  const alertes = calculerAlertes({ ref, heure: new Date().getHours(), bandes, pontes: ponte, derniereSauvegarde: r?.derniere_sauvegarde ?? null, seuils: r?.seuils })

  return (
    <main>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Oeuf taille={38} />
        <div>
          <div className="discret">Bonjour · {nomMois}</div>
          <h1 style={{ margin: 0 }}>The Good Farm</h1>
        </div>
      </div>

      <div className="vedette">
        <div className="discret">Résultat de {nomMois}</div>
        <div className="grand" data-testid="resultat"><Compteur valeur={ce.resultat} format={formatFCFA} /></div>
        {ecartResultat != null && (
          <div className="variation">{ecartResultat >= 0 ? `▲ +${formatFCFA(ecartResultat)}` : `▼ ${formatFCFA(ecartResultat)}`} par rapport à {nomMoisPrecedent}</div>
        )}
      </div>

      <nav aria-label="Raccourcis" className="raccourcis">
        {RACCOURCIS.map(({ vers, libelle, Icone, fond, texte }) => (
          <Link key={vers} to={vers} style={{ background: fond, color: texte }}>
            <Icone size={24} aria-hidden="true" />{libelle}
          </Link>
        ))}
      </nav>

      {enAttente > 0 && <div className="alerte attention">En attente d’envoi ({enAttente})</div>}
      {alertes.map((a, i) => <Alerte key={i} alerte={a} />)}

      <div className="grille2" style={{ margin: '4px 0 12px' }}>
        <CarteMetrique libelle="Ventes" valeur={formatFCFA(ce.ventes)} variation={variation(ce.ventes, avant?.ventes)} />
        <CarteMetrique libelle="Dépenses" valeur={formatFCFA(ce.depenses)} variation={variation(ce.depenses, avant?.depenses)} hausseMauvaise />
        <Link to="/clients" style={{ color: 'inherit', textDecoration: 'none' }}>
          <CarteMetrique libelle="Crédits dus" valeur={formatFCFA(credits)} />
        </Link>
        {stock ? (
          <CarteMetrique libelle="Stock d’œufs" valeur={`${stock.lots} plateaux${stock.restants ? ` + ${stock.restants}` : ''}`} />
        ) : (
          <Link to="/reglages" className="metrique" style={{ color: 'var(--vert)', textDecoration: 'none', fontWeight: 700 }}>
            <div className="discret">Stock d’œufs</div>Faire l’inventaire →
          </Link>
        )}
      </div>

      <section aria-label="Ponte d’hier" className="carte">
        <h2 style={{ marginTop: 0 }}>Ponte d’hier</h2>
        {ponteHier.map(({ b, taux, attendu }) => {
          const classe = taux == null ? '' : couleurTaux(taux, attendu)
          return (
            <div key={b.id} style={{ padding: '6px 0' }}>
              <div className="ligne" style={{ padding: '0 0 4px' }}>
                <span>{b.nom} <span className="discret">box {b.box}</span></span>
                {taux == null ? <span className="discret">non saisie</span> : <strong className={classe}>{Math.round(taux * 100)} %</strong>}
              </div>
              <div className={`jauge ${classe === 'ok' ? '' : classe}`}><span style={{ width: `${taux == null ? 0 : Math.min(100, Math.round(taux * 100))}%` }} /></div>
            </div>
          )
        })}
        <div className="ligne" style={{ borderTop: '1px solid var(--bord)', marginTop: 6 }}>
          <span>Ferme</span>
          <strong>{totalHier.lots} plateaux + {totalHier.restants}</strong>
        </div>
      </section>
    </main>
  )
}
