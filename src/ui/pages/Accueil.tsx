import { IconBell } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { useDonnees } from '../../data/useDonnees'
import { etatAliment, JOURS_ALERTE_ALIMENT } from '../../lib/calculs/aliment'
import { boxesFerme } from '../../lib/calculs/boxes'
import { CALIBRES, nomCle, ORDRE_CLES, stockParCalibre } from '../../lib/calculs/calibres'
import { bilanMensuel, tresorerieMois } from '../../lib/calculs/bilans'
import { soldesClients } from '../../lib/calculs/credits'
import { dettesFournisseurs } from '../../lib/calculs/dettes'
import { OEUFS_PAR_PLATEAU, decomposer, stockOeufs } from '../../lib/calculs/oeufs'
import { aujourdhui, formatFCFA } from '../../lib/format'
import { Compteur } from '../composants/animations'
import { Alerte, CarteMetrique } from '../composants/communs'
import { Oeuf } from '../composants/Oeuf'
import { Pastille } from '../composants/Pastille'
import { useAlertes } from '../useAlertes'

const NOMS_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

function variation(actuel: number, precedent: number | undefined): number | null {
  return precedent ? (actuel - precedent) / precedent : null
}

function moisPrecedent(periode: string): string {
  const [a, m] = periode.split('-').map(Number)
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`
}


export function Accueil() {
  const { transactions, paiements, clients, produits, bandes, ponte, reglages } = useDonnees()
  const ref = aujourdhui()
  const r = reglages[0]

  const mois = ref.slice(0, 7)
  const nomMois = NOMS_MOIS[Number(mois.slice(5)) - 1]
  const bilan = bilanMensuel(transactions)
  const ce = bilan.find((l) => l.periode === mois) ?? { ventes: 0, depenses: 0, resultat: 0 }
  const avant = bilan.find((l) => l.periode === moisPrecedent(mois))
  const credits = soldesClients(clients, transactions, paiements).filter((s) => s.solde > 0).reduce((t, s) => t + s.solde, 0)
  const dettes = dettesFournisseurs(clients, transactions, paiements, ref)
  const caisse = tresorerieMois(transactions, paiements, mois)
  // Écart en francs : un pourcentage n'a pas de sens quand le résultat est négatif.
  const ecartResultat = avant ? ce.resultat - avant.resultat : null
  const nomMoisPrecedent = NOMS_MOIS[Number(moisPrecedent(mois).slice(5)) - 1]

  const stock = r?.stock_depart ? decomposer(Math.max(0, stockOeufs({ pontes: ponte, transactions, produits, depart: r.stock_depart })), OEUFS_PAR_PLATEAU) : null
  const stockCalibres = r?.stock_depart ? stockParCalibre({ pontes: ponte, transactions, produits, depart: r.stock_depart, bandes, boxes: boxesFerme(r, bandes) }) : {}

  const { nouvelles, total: nbAlertes, marquerVue } = useAlertes()
  const aliment = etatAliment({ transactions, pontes: ponte, produits, reglage: r?.aliment }, ref)
  const premiere = nouvelles[0]

  return (
    <main>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Oeuf taille={38} />
        <div>
          <div className="discret">Bonjour · {nomMois}</div>
          <h1 style={{ margin: 0 }}>The Good Farm</h1>
        </div>
        <Link to="/alertes" className="cloche" aria-label={nouvelles.length ? `Alertes : ${nouvelles.length} à voir` : 'Alertes'}>
          <IconBell size={26} stroke={1.75} aria-hidden="true" />
          {nouvelles.length > 0 && (
            <span className={`pastille-nombre ${nouvelles.some((a) => a.niveau === 'danger') ? 'danger' : 'attention'}`} aria-hidden="true">{nouvelles.length}</span>
          )}
        </Link>
      </div>

      {stock ? (
        <Link to="/stock" className="stock-accueil" style={{ color: 'inherit', textDecoration: 'none' }}>
          <CarteMetrique genre="stock" libelle="Stock d’œufs au magasin" valeur={`${stock.lots} plateaux${stock.restants ? ` + ${stock.restants}` : ''}`}
            detail={CALIBRES.some((c) => stockCalibres[c]) && (
              <div className="stock-calibres" aria-label="Stock par calibre">
                {ORDRE_CLES.filter((k) => stockCalibres[k]).map((k) => (
                  <span key={k}><span className={`pastille-calibre ${k}`}>{nomCle(k)}</span> {Math.floor(stockCalibres[k]! / OEUFS_PAR_PLATEAU)}</span>
                ))}
              </div>
            )} />
        </Link>
      ) : (
        <Link to="/reglages" className="metrique stock-accueil" style={{ color: 'var(--vert)', textDecoration: 'none', fontWeight: 700 }}>
          <div className="tete"><Pastille genre="stock" petite /><span className="discret">Stock d’œufs</span></div>Faire l’inventaire →
        </Link>
      )}

      <div className={`vedette${ce.resultat < 0 ? ' vedette-perte' : ''}`}>
        <div className="discret">Résultat de {nomMois}</div>
        <div className="grand" data-testid="resultat"><Compteur valeur={ce.resultat} format={formatFCFA} /></div>
        {ecartResultat != null && (
          <div className="variation">{ecartResultat >= 0 ? `▲ +${formatFCFA(ecartResultat)}` : `▼ ${formatFCFA(ecartResultat)}`} par rapport à {nomMoisPrecedent}</div>
        )}
      </div>
      <p className="tresorerie" aria-label="Trésorerie du mois">
        Argent réellement entré : <strong className="entree">{formatFCFA(caisse.entre)}</strong>
        {' · '}sorti : <strong className="sortie">{formatFCFA(caisse.sorti)}</strong>
        {' · '}encore à payer aux fournisseurs : <strong className={dettes.total > 0 ? 'du' : ''}>{formatFCFA(dettes.total)}</strong>
      </p>

      {premiere && (
        <div className="bandeau-alerte">
          <Link to="/alertes" aria-label="Voir les alertes">
            <Alerte alerte={{ ...premiere, message: `${premiere.message}${nouvelles.length > 1 ? ` · et ${nouvelles.length - 1} autre${nouvelles.length > 2 ? 's' : ''}` : ''} →` }} />
          </Link>
          <button className={`vu-bandeau ${premiere.niveau}`} onClick={() => marquerVue(premiere.cle)} aria-label="Marquer cette alerte comme vue">Vu</button>
        </div>
      )}
      {nbAlertes === 0 && <div className="alerte info" role="status">Tout va bien aujourd’hui ✓</div>}

      <div className="grille2" style={{ margin: '4px 0 12px' }}>
        <Link to="/saisir" aria-label="Saisir une vente" style={{ color: 'inherit', textDecoration: 'none' }}>
          <CarteMetrique genre="vente" libelle="Ventes" valeur={formatFCFA(ce.ventes)} variation={variation(ce.ventes, avant?.ventes)} />
        </Link>
        <Link to="/saisir?type=depense" aria-label="Saisir une dépense" style={{ color: 'inherit', textDecoration: 'none' }}>
          <CarteMetrique genre="depense" libelle="Dépenses" valeur={formatFCFA(ce.depenses)} variation={variation(ce.depenses, avant?.depenses)} hausseMauvaise />
        </Link>
        <Link to="/clients" style={{ color: 'inherit', textDecoration: 'none' }}>
          <CarteMetrique genre="credit" libelle="Crédits dus" valeur={formatFCFA(credits)} teinteValeur={credits > 0 ? 'du' : undefined} />
        </Link>
        <Link to="/fournisseurs" style={{ color: 'inherit', textDecoration: 'none' }}>
          <CarteMetrique genre="aPayer" libelle="À payer" valeur={formatFCFA(dettes.total)} teinteValeur={dettes.total > 0 ? 'du' : undefined} />
        </Link>
        <Link to="/aliment" style={{ color: 'inherit', textDecoration: 'none' }}>
          <CarteMetrique genre="aliment" libelle="Aliment"
            valeur={aliment.jours != null ? `≈ ${aliment.jours} jour${aliment.jours > 1 ? 's' : ''}` : 'Compter les sacs →'}
            teinteValeur={aliment.jours != null && aliment.jours <= (r?.aliment?.jours_alerte || JOURS_ALERTE_ALIMENT) ? 'du' : undefined} />
        </Link>
      </div>

    </main>
  )
}
