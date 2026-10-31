import { NavLink } from 'react-router-dom'
import { ICONES, NAV } from '../icones'

const LIENS = [
  { vers: '/', libelle: 'Accueil', Icone: NAV.accueil },
  { vers: '/saisir', libelle: 'Saisir', Icone: NAV.saisir },
  { vers: '/ponte', libelle: 'Ponte', Icone: ICONES.ponte },
  { vers: '/bandes', libelle: 'Bandes', Icone: ICONES.bande },
  { vers: '/plus', libelle: 'Plus', Icone: NAV.plus },
]

export function BarreNav() {
  return (
    <nav className="barre" aria-label="Navigation principale">
      {LIENS.map(({ vers, libelle, Icone }) => (
        <NavLink key={vers} to={vers} end={vers === '/'}>
          <span className="icone" aria-hidden="true"><Icone size={22} stroke={2} /></span>
          {libelle}
        </NavLink>
      ))}
    </nav>
  )
}
