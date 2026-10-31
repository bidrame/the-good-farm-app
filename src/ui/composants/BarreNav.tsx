import { IconCirclePlus, IconDots, IconEgg, IconFeather, IconHome } from '@tabler/icons-react'
import { NavLink } from 'react-router-dom'

const LIENS = [
  { vers: '/', libelle: 'Accueil', Icone: IconHome },
  { vers: '/saisir', libelle: 'Saisir', Icone: IconCirclePlus },
  { vers: '/ponte', libelle: 'Ponte', Icone: IconEgg },
  { vers: '/bandes', libelle: 'Bandes', Icone: IconFeather },
  { vers: '/plus', libelle: 'Plus', Icone: IconDots },
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
