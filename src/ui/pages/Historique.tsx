import { useState } from 'react'
import { useDonnees } from '../../data/useDonnees'
import { formatDate } from '../../lib/format'
import { Confirmation } from '../composants/communs'
import { journal, type LigneJournal } from '../lignes'
import { EtatVide, Pastille, Titre } from '../composants/Pastille'
import type { Genre as GenreIcone } from '../icones'

const MAX_LIGNES = 100
const GENRE_ICONE: Record<LigneJournal['genre'], GenreIcone> = { vente: 'vente', depense: 'depense', paiement: 'paiement', ponte: 'ponte' }
// Entrées en vert, sorties en rouge ; la ponte reste neutre.
const TEINTE_MONTANT: Record<LigneJournal['genre'], string> = { vente: 'entree', paiement: 'entree', depense: 'sortie', ponte: '' }
type Genre = 'tout' | LigneJournal['genre']

export function Historique() {
  const d = useDonnees()
  const [genre, setGenre] = useState<Genre>('tout')
  const [client, setClient] = useState('')
  const [produit, setProduit] = useState('')
  const [du, setDu] = useState('')
  const [au, setAu] = useState('')
  const [aSupprimer, setASupprimer] = useState<LigneJournal | null>(null)

  const lignes = journal(d)
    .filter((l) => !l.supprime_le)
    .filter((l) => genre === 'tout' || l.genre === genre)
    .filter((l) => !client || l.client_id === client)
    .filter((l) => !produit || l.produit_id === produit)
    .filter((l) => (!du || l.date >= du) && (!au || l.date <= au))

  return (
    <main>
      <Titre genre="historique">Historique</Titre>
      <div className="grille2">
        <label>
          Type
          <select value={genre} onChange={(e) => setGenre(e.target.value as Genre)}>
            <option value="tout">Tout</option>
            <option value="vente">Ventes</option>
            <option value="depense">Dépenses</option>
            <option value="paiement">Paiements</option>
            <option value="ponte">Ponte</option>
          </select>
        </label>
        <label>
          Client
          <select value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="">Tous</option>
            {[...d.clients].filter((c) => !c.supprime_le).sort((a, b) => a.nom.localeCompare(b.nom)).map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </label>
        <label>Du<input type="date" value={du} onChange={(e) => setDu(e.target.value)} /></label>
        <label>Au<input type="date" value={au} onChange={(e) => setAu(e.target.value)} /></label>
      </div>
      <label>
        Produit
        <select value={produit} onChange={(e) => setProduit(e.target.value)}>
          <option value="">Tous</option>
          {d.produits.filter((p) => !p.supprime_le).map((p) => <option key={p.id} value={p.id}>{p.nom} ({p.type === 'vente' ? 'vente' : 'dépense'})</option>)}
        </select>
      </label>

      <p className="discret">{lignes.length} saisie(s){lignes.length > MAX_LIGNES ? `, ${MAX_LIGNES} affichées` : ''}</p>
      {lignes.length === 0 && <EtatVide genre="historique" message="Aucune saisie ne correspond à ces filtres." />}
      {lignes.slice(0, MAX_LIGNES).map((l) => (
        <article key={`${l.table}-${l.id}`} className="carte">
          <div className="ligne" style={{ padding: 0 }}>
            <span className="entete-ligne">
              <Pastille genre={GENRE_ICONE[l.genre]} petite />
              <strong>{l.titre}</strong>
            </span>
            <span className="discret">{formatDate(l.date)}</span>
          </div>
          <div className={TEINTE_MONTANT[l.genre]}>{l.detail}</div>
          <div className="ligne" style={{ padding: 0 }}>
            <span className="discret">par {l.auteur}</span>
            <button className="lien" onClick={() => setASupprimer(l)}>Supprimer</button>
          </div>
        </article>
      ))}

      {aSupprimer && (
        <Confirmation
          message={`Supprimer « ${aSupprimer.titre} » du ${formatDate(aSupprimer.date)} ? Elle restera 30 jours dans la corbeille.`}
          oui="Supprimer"
          onOui={async () => {
            await d.supprimer(aSupprimer.table, aSupprimer.id)
            setASupprimer(null)
          }}
          onNon={() => setASupprimer(null)}
        />
      )}
    </main>
  )
}
