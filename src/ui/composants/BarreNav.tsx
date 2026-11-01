import { NavLink, useLocation } from 'react-router-dom'
import { ICONES, NAV } from '../icones'
import { estDansPlus } from './Retour'

const LIENS = [
  { vers: '/', libelle: 'Accueil', Icone: NAV.accueil },
  { vers: '/saisir', libelle: 'Saisir', Icone: NAV.saisir },
  { vers: '/ponte', libelle: 'Ponte', Icone: ICONES.ponte },
  { vers: '/livraison', libelle: 'Livraison', Icone: ICONES.ramassage },
  { vers: '/plus', libelle: 'Plus', Icone: NAV.plus },
]

export function BarreNav() {
  const { pathname } = useLocation()
  return (
    <nav className="barre" aria-label="Navigation principale">
      {LIENS.map(({ vers, libelle, Icone }) => (
        <NavLink key={vers} to={vers} end={vers === '/'} className={({ isActive }) => (isActive || (vers === '/plus' && estDansPlus(pathname)) ? 'active' : '')}>
          <span className="icone" aria-hidden="true"><Icone size={22} stroke={2} /></span>
          {libelle}
        </NavLink>
      ))}
    </nav>
  )
}
