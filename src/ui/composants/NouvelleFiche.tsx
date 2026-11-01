import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDonnees } from '../../data/useDonnees'
import { personnesSemblables } from '../../lib/calculs/doublons'
import { ChampTelephone } from './ChampTelephone'
import { BoutonAjout } from './Pastille'

/** « + Nouveau client » / « + Nouveau fournisseur » : nom, téléphone (ou contact du téléphone), note ; pas de doublon. */
export function NouvelleFiche({ genre }: { genre: 'client' | 'fournisseur' }) {
  const { clients, enregistrer } = useDonnees()
  const navigate = useNavigate()
  const [ouvert, setOuvert] = useState(false)
  const [nom, setNom] = useState('')
  const [telephone, setTelephone] = useState('')
  const [notes, setNotes] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [autrePersonne, setAutrePersonne] = useState(false)
  const base = genre === 'client' ? '/clients' : '/fournisseurs'
  const libelle = genre === 'client' ? 'Nouveau client' : 'Nouveau fournisseur'
  const { identique, memeNumero, proches } = personnesSemblables(nom, telephone, clients)
  const bloque = !!identique || !!memeNumero || (proches.length > 0 && !autrePersonne)

  async function valider() {
    if (!nom.trim()) return setErreur('Le nom est obligatoire.')
    if (bloque) return
    const id = crypto.randomUUID()
    await enregistrer('clients', { id, nom: nom.trim(), telephone: telephone.trim() || null, notes: notes.trim() || null })
    navigate(`${base}/${id}`)
  }

  if (!ouvert) return <BoutonAjout onClick={() => setOuvert(true)} style={{ width: '100%', marginBottom: 12 }}>{libelle}</BoutonAjout>
  return (
    <form aria-label={libelle} className="carte" onSubmit={(e) => { e.preventDefault(); void valider() }}>
      <h2 style={{ marginTop: 0 }}>{libelle}</h2>
      <label>Nom<input value={nom} onChange={(e) => { setNom(e.target.value); setErreur(null); setAutrePersonne(false) }} autoFocus /></label>
      {identique && (
        <div className="erreur">
          Ce nom existe déjà. <Link to={`${base}/${identique.id}`}>Ouvrir la fiche de {identique.nom}</Link>
        </div>
      )}
      {erreur && <div className="erreur">{erreur}</div>}
      <ChampTelephone valeur={telephone} onChange={setTelephone}
        onContact={(c) => { setTelephone(c.telephone); if (!nom.trim() && c.nom) setNom(c.nom) }} />
      {memeNumero && (
        <div className="erreur" style={{ marginTop: -6, marginBottom: 10 }}>
          Ce numéro est déjà celui de {memeNumero.nom}. <Link to={`${base}/${memeNumero.id}`}>Ouvrir sa fiche</Link>
        </div>
      )}
      {!identique && !memeNumero && proches.length > 0 && (
        <div role="alert" className="alerte attention" style={{ display: 'block' }}>
          <div>Ressemble à : {proches.map((p, i) => (
            <span key={p.id}>{i > 0 && ', '}<Link to={`${base}/${p.id}`}>{p.nom}</Link></span>
          ))}. Est-ce la même personne ?</div>
          <label className="case" style={{ marginTop: 8, marginBottom: 0, color: 'inherit' }}>
            <input type="checkbox" checked={autrePersonne} onChange={(e) => setAutrePersonne(e.target.checked)} />
            <span>Non, c’est une autre personne</span>
          </label>
        </div>
      )}
      <label>Note<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={genre === 'client' ? 'marché, jour de livraison…' : 'ce qu’il vend, conditions…'} /></label>
      <div className="grille2">
        <button type="button" onClick={() => setOuvert(false)}>Annuler</button>
        <button type="submit" className="principal" disabled={bloque}>Enregistrer</button>
      </div>
    </form>
  )
}
