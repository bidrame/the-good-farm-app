/** Faux client Supabase en mémoire : sous-ensemble utilisé par src/data (from().select/range/upsert/update/eq). */
export function fauxSupabase(tables: Record<string, Record<string, unknown>[]> = {}) {
  const appels: { table: string; action: string }[] = []
  const lignes = (t: string) => (tables[t] ??= [])
  const client = {
    appels,
    tables,
    from(table: string) {
      return {
        select() {
          let tri: string | null = null
          const requete = {
            order(col: string) {
              tri = col
              appels.push({ table, action: `order ${col}` })
              return requete
            },
            range(debut: number, fin: number) {
              appels.push({ table, action: `range ${debut}-${fin}` })
              const l = tri ? [...lignes(table)].sort((a, b) => String(a[tri!]).localeCompare(String(b[tri!]))) : lignes(table)
              return Promise.resolve({ data: l.slice(debut, fin + 1), error: null })
            },
          }
          return requete
        },
        upsert(ligne: Record<string, unknown>) {
          appels.push({ table, action: 'upsert' })
          const l = lignes(table)
          const i = l.findIndex((x) => x.id === ligne.id)
          if (i >= 0) l[i] = { ...l[i], ...ligne }
          else l.push({ ...ligne })
          return Promise.resolve({ error: null })
        },
        update(champs: Record<string, unknown>) {
          return {
            eq(_col: string, id: unknown) {
              appels.push({ table, action: 'update' })
              const x = lignes(table).find((r) => r.id === id)
              if (x) Object.assign(x, champs)
              return Promise.resolve({ error: null })
            },
          }
        },
      }
    },
  }
  return client
}
