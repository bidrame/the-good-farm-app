import { NavLink } from 'react-router-dom'

const LIENS = [
  { vers: '/', libelle: 'Accueil', icone: '🏠' },
  { vers: '/saisir', libelle: 'Saisir', icone: '💰' },
  { vers: '/ponte', libelle: 'Ponte', icone: '🥚' },
  { vers: '/bandes', libelle: 'Bandes', icone: '🐔' },
  { vers: '/plus', libelle: 'Plus', icone: '☰' },
]

export function BarreNav() {
  return (
    <nav className="barre">
      {LIENS.map((l) => (
        <NavLink key={l.vers} to={l.vers} end={l.vers === '/'}>
          <span className="icone" aria-hidden="true">{l.icone}</span>
          {l.libelle}
        </NavLink>
      ))}
    </nav>
  )
}
