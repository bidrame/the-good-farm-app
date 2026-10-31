import { useState } from 'react'
import { seConnecter } from '../../data/auth'
import { Oeuf } from '../composants/Oeuf'

export function Connexion() {
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  return (
    <main>
      <div style={{ textAlign: 'center', margin: '28px 0 18px' }}>
        <Oeuf taille={84} />
        <h1 style={{ marginTop: 8 }}>The Good Farm</h1>
        <p className="discret" style={{ marginTop: -6 }}>La ferme dans votre poche</p>
      </div>
      <form
        className="carte"
        onSubmit={async (e) => {
          e.preventDefault()
          setEnvoi(true)
          setErreur(await seConnecter(email.trim(), motDePasse))
          setEnvoi(false)
        }}
      >
        <h2>Connexion</h2>
        <label>
          E-mail
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Mot de passe
          <input type="password" autoComplete="current-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} required />
        </label>
        {erreur && <div className="erreur">{erreur}</div>}
        <button className="principal" disabled={envoi}>{envoi ? 'Connexion…' : 'Se connecter'}</button>
      </form>
    </main>
  )
}
