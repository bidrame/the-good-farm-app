import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useDonnees } from '../../data/useDonnees'
import { bilanAnnuel, bilanMensuel, classementClients, parProduit } from '../../lib/calculs/bilans'
import { statsVentesOeufs } from '../../lib/calculs/oeufs'
import { aujourdhui, formatFCFA } from '../../lib/format'
import { couleur } from '../couleurs'

type Periode = 'mois' | 'annee' | 'tout'
const NB_CLIENTS = 30
const pct = (x: number) => `${Math.round(x * 100)} %`

function Tableau({ titre, entetes, lignes }: { titre: string; entetes: string[]; lignes: (string | number)[][] }) {
  return (
    <section aria-label={titre} className="carte">
      <h2 style={{ marginTop: 0 }}>{titre}</h2>
      {lignes.length === 0 ? <p className="discret">Aucune donnée sur la période.</p> : (
        <div style={{ overflowX: 'auto' }}><table>
          <thead><tr>{entetes.map((e, i) => <th key={e} className={i ? 'nombre' : ''}>{e}</th>)}</tr></thead>
          <tbody>{lignes.map((l, i) => <tr key={i}>{l.map((c, j) => <td key={j} className={j ? 'nombre' : ''}>{c}</td>)}</tr>)}</tbody>
        </table></div>
      )}
    </section>
  )
}

export function Rapports() {
  const { transactions, produits, clients } = useDonnees()
  const [periode, setPeriode] = useState<Periode>('mois')
  const ref = aujourdhui()
  const prefixe = periode === 'mois' ? ref.slice(0, 7) : periode === 'annee' ? ref.slice(0, 4) : ''
  const txs = transactions.filter((t) => t.date.startsWith(prefixe))

  const mensuel = bilanMensuel(txs)
  const ventes = parProduit(txs, produits, 'vente')
  const depenses = parProduit(txs, produits, 'depense')
  const oeufs = statsVentesOeufs(txs, produits)

  return (
    <main>
      <h1>Rapports</h1>
      <label>
        Période
        <select value={periode} onChange={(e) => setPeriode(e.target.value as Periode)}>
          <option value="mois">Ce mois</option>
          <option value="annee">Cette année</option>
          <option value="tout">Tout</option>
        </select>
      </label>

      {mensuel.length > 1 && (
        <div className="carte" style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mensuel.map((l) => ({ ...l, resultat: Math.round(l.resultat / 1000) }))} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={couleur('--bord', '#d9d7cf')} />
              <XAxis dataKey="periode" tick={{ fontSize: 10, fill: couleur('--texte-2', '#5f5e5a') }} />
              <YAxis tick={{ fontSize: 10, fill: couleur('--texte-2', '#5f5e5a') }} unit="k" />
              <Tooltip formatter={(v: number) => [`${v} 000 F`, 'Résultat']} />
              <Bar dataKey="resultat" fill={couleur('--vert')} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <Tableau titre="Bilan mensuel" entetes={['Mois', 'Ventes', 'Dépenses', 'Résultat', 'Cumul']}
        lignes={mensuel.map((l) => [l.periode, formatFCFA(l.ventes), formatFCFA(l.depenses), formatFCFA(l.resultat), formatFCFA(l.cumul)])} />
      {periode !== 'mois' && (
        <Tableau titre="Bilan par année" entetes={['Année', 'Ventes', 'Dépenses', 'Résultat', 'Marge']}
          lignes={bilanAnnuel(txs).map((l) => [l.periode, formatFCFA(l.ventes), formatFCFA(l.depenses), formatFCFA(l.resultat), l.ventes ? pct(l.resultat / l.ventes) : '—'])} />
      )}
      <section aria-label="Œufs vendus" className="carte">
        <h2 style={{ marginTop: 0 }}>Œufs vendus</h2>
        <div className="ligne"><span className="discret">Œufs</span><strong>{oeufs.oeufs.toLocaleString('fr-FR')} œufs</strong></div>
        <div className="ligne"><span className="discret">En plateaux de 30</span><strong>{Math.round(oeufs.plateaux).toLocaleString('fr-FR')} plateaux</strong></div>
        <div className="ligne"><span className="discret">Prix moyen du plateau</span><strong>{oeufs.prixMoyenPlateau == null ? '—' : formatFCFA(oeufs.prixMoyenPlateau)}</strong></div>
      </section>
      <Tableau titre="Ventes par produit" entetes={['Produit', 'Quantité', 'Montant', 'Part']}
        lignes={ventes.map((l) => [l.produit.nom, l.quantite, formatFCFA(l.montant), pct(l.part)])} />
      <Tableau titre="Classement des clients" entetes={['Client', 'Achats', 'CA', 'Part']}
        lignes={classementClients(txs, clients).slice(0, NB_CLIENTS).map((l) => [l.client.nom, l.nb, formatFCFA(l.ca), pct(l.part)])} />
      <Tableau titre="Dépenses par poste" entetes={['Poste', 'Montant', 'Part']}
        lignes={depenses.map((l) => [l.produit.nom, formatFCFA(l.montant), pct(l.part)])} />
    </main>
  )
}
