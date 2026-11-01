import { Link } from 'react-router-dom'
import { Alerte } from '../composants/communs'
import { EtatVide, Titre } from '../composants/Pastille'
import { useAlertes, type AlerteAction } from '../useAlertes'

const GROUPES = [
  { niveau: 'danger', titre: 'Urgent' },
  { niveau: 'attention', titre: 'À surveiller' },
  { niveau: 'info', titre: 'Info' },
] as const

function CarteAlerte({ a, vue, onVu, onRemettre }: { a: AlerteAction; vue?: boolean; onVu?: () => void; onRemettre?: () => void }) {
  return (
    <article className={`carte carte-alerte${vue ? ' vue' : ''}`}>
      <Alerte alerte={a} />
      <div className="actions-alerte">
        {a.action && <Link to={a.action.vers} className="bouton-lien">{a.action.libelle}</Link>}
        {onVu && <button onClick={onVu}>Vu</button>}
        {onRemettre && <button className="lien" onClick={onRemettre}>Remettre</button>}
      </div>
    </article>
  )
}

export function Alertes() {
  const { nouvelles, vues, total, marquerVue, remettre } = useAlertes()
  return (
    <main>
      <Titre genre="alerte">Alertes</Titre>
      {total === 0 && <EtatVide genre="alerte" message="Tout va bien aujourd’hui ✓" />}
      {total > 0 && nouvelles.length === 0 && <p className="ok" style={{ fontWeight: 700 }}>Tout est vu ✓ Les alertes restent ci-dessous tant que la situation n’est pas réglée.</p>}
      {GROUPES.map(({ niveau, titre }) => {
        const liste = nouvelles.filter((a) => a.niveau === niveau)
        return liste.length > 0 && (
          <section key={niveau} aria-label={titre}>
            <h2>{titre}</h2>
            {liste.map((a) => <CarteAlerte key={a.cle} a={a} onVu={() => marquerVue(a.cle)} />)}
          </section>
        )
      })}
      {vues.length > 0 && (
        <section aria-label="Déjà vues">
          <h2>Déjà vues</h2>
          {vues.map((a) => <CarteAlerte key={a.cle} a={a} vue onRemettre={() => remettre(a.cle)} />)}
        </section>
      )}
    </main>
  )
}
