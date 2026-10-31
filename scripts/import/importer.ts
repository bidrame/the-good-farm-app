// Usage : npx tsx scripts/import/importer.ts <classeur.xlsx> import/fusions.csv
import { readFileSync } from 'node:fs'
import { construireImport, lireFusionsCsv, totauxParAnnee, lireTotauxAttendus } from './construireImport'
import { clientAdmin } from './env'
import { lireClasseur } from './lireClasseur'

const LOT = 500

async function main() {
  const [classeur, csv] = process.argv.slice(2)
  const lu = lireClasseur(classeur)
  const imp = construireImport(lu, lireFusionsCsv(readFileSync(csv, 'utf8')))

  const totaux = totauxParAnnee(imp.transactions)
  if (JSON.stringify(totaux) !== JSON.stringify(lireTotauxAttendus())) {
    console.error('Totaux différents du classeur, import annulé.', totaux)
    process.exit(1)
  }
  for (const r of lu.rejets) console.log(`Mis de côté : ${r.feuille} ligne ${r.ligne} (${r.raison})`)

  const sb = clientAdmin()
  for (const table of ['ouvriers', 'clients', 'produits', 'bandes', 'transactions', 'ponte'] as const) {
    const lignes = imp[table] as unknown as Record<string, unknown>[]
    for (let i = 0; i < lignes.length; i += LOT) {
      const { error } = await sb.from(table).upsert(lignes.slice(i, i + LOT), { onConflict: 'id' })
      if (error) throw new Error(`${table} : ${error.message}`)
    }
    console.log(`${table} : ${lignes.length}`)
  }
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
