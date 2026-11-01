import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Bande, Client, Mortalite, Ouvrier, Paiement, Ponte, Produit, Ramassage, Recensement, Reglages, Transaction } from '../lib/types'
import { abandonner, enAttente as compterEnAttente, lister, listerRejetees, reessayer, type NomTable, type Rejetee } from './fileAttente'
import { lireInstantane, sauverInstantane } from './instantane'
import { creerRafraichisseur } from './rafraichisseur'
import * as repo from './repo'
import { appliquerEnAttente, chargerTout, synchroniser } from './repo'
import { supabase } from './supabase'

export type Profil = { id: string; prenom: string }

export type Donnees = {
  clients: Client[]
  produits: Produit[]
  ouvriers: Ouvrier[]
  transactions: Transaction[]
  paiements: Paiement[]
  bandes: Bande[]
  ponte: Ponte[]
  recensements: Recensement[]
  mortalites: Mortalite[]
  ramassages: Ramassage[]
  profils: Profil[]
  reglages: (Reglages & { id: number })[]
}

export const DONNEES_VIDES: Donnees = {
  clients: [], produits: [], ouvriers: [], transactions: [], paiements: [], bandes: [], ponte: [], recensements: [], mortalites: [], ramassages: [], profils: [], reglages: [],
}

export type ContexteDonnees = Donnees & {
  chargement: boolean
  erreur: string | null
  enAttente: number
  rejetees: Rejetee[]
  rafraichir: () => Promise<void>
  enregistrer: (table: NomTable, ligne: Record<string, unknown>) => Promise<string | number>
  supprimer: (table: NomTable, id: string) => Promise<void>
  restaurer: (table: NomTable, id: string) => Promise<void>
  reessayer: (id: string) => Promise<void>
  abandonner: (id: string) => Promise<void>
}

export type Actions = Pick<ContexteDonnees, 'enregistrer' | 'supprimer' | 'restaurer' | 'reessayer' | 'abandonner'>

const Contexte = createContext<ContexteDonnees | null>(null)

const TABLES = Object.keys(DONNEES_VIDES) as (keyof Donnees)[]
const INTERVALLE_SYNCHRO_MS = 30_000

export function DonneesProvider({ children }: { children: ReactNode }) {
  const serveur = useRef<Donnees>(DONNEES_VIDES)
  const [vue, setVue] = useState<Donnees>(DONNEES_VIDES)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enAttente, setEnAttente] = useState(0)
  const [rejetees, setRejetees] = useState<Rejetee[]>([])

  const superposer = useCallback(async () => {
    setVue(appliquerEnAttente(serveur.current as never, await lister()) as unknown as Donnees)
    setEnAttente(await compterEnAttente())
    setRejetees(await listerRejetees())
  }, [])

  const rafraichir = useMemo(() => {
    const charger = async () => {
      await synchroniser()
      const lus = await Promise.all(TABLES.map((t) => chargerTout(supabase, t)))
      return Object.fromEntries(TABLES.map((t, i) => [t, lus[i]])) as unknown as Donnees
    }
    const unique = creerRafraichisseur(charger, (d) => {
      serveur.current = d
      void sauverInstantane(d)
      setErreur(null)
    })
    return async () => {
      try {
        await unique()
      } catch {
        setErreur('Connexion impossible. Les saisies sont gardées sur le téléphone.')
      } finally {
        await superposer()
        setChargement(false)
      }
    }
  }, [superposer])

  useEffect(() => {
    let actif = true
    void lireInstantane<Donnees>().then(async (d) => {
      if (actif && d && serveur.current === DONNEES_VIDES) {
        serveur.current = { ...DONNEES_VIDES, ...d }
        await superposer()
        setChargement(false)
      }
    })
    void rafraichir()
    const recharger = () => void rafraichir()
    const auRetour = () => document.visibilityState === 'visible' && recharger()
    window.addEventListener('online', recharger)
    document.addEventListener('visibilitychange', auRetour)
    const minuteur = window.setInterval(recharger, INTERVALLE_SYNCHRO_MS)
    return () => {
      actif = false
      window.removeEventListener('online', recharger)
      document.removeEventListener('visibilitychange', auRetour)
      window.clearInterval(minuteur)
    }
  }, [rafraichir, superposer])

  const actions = useMemo<Actions>(() => {
    // Après une écriture : affichage immédiat, puis envoi et rechargement (regroupés).
    const apres = async () => {
      await superposer()
      void rafraichir()
    }
    return {
      enregistrer: async (table, ligne) => {
        const id = await repo.enregistrer(table, ligne)
        await apres()
        return id
      },
      supprimer: async (table, id) => {
        await repo.supprimer(table, id)
        await apres()
      },
      restaurer: async (table, id) => {
        await repo.restaurer(table, id)
        await apres()
      },
      reessayer: async (id) => {
        await reessayer(id)
        await apres()
      },
      abandonner: async (id) => {
        await abandonner(id)
        await superposer()
      },
    }
  }, [superposer, rafraichir])

  const valeur = useMemo(
    () => ({ ...vue, chargement, erreur, enAttente, rejetees, rafraichir, ...actions }),
    [vue, chargement, erreur, enAttente, rejetees, rafraichir, actions],
  )
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>
}

/** Fournisseur de test : données fixes, sans réseau. */
export function DonneesFixes({ donnees, actions, enAttente = 0, erreur = null, rejetees = [], rafraichir, children }: {
  donnees: Partial<Donnees>; actions?: Partial<Actions>; enAttente?: number; erreur?: string | null; rejetees?: Rejetee[]
  rafraichir?: () => Promise<void>; children: ReactNode
}) {
  const valeur: ContexteDonnees = {
    ...DONNEES_VIDES, ...donnees, chargement: false, erreur, enAttente, rejetees, rafraichir: rafraichir ?? (async () => {}),
    enregistrer: async (_t, l) => (l.id as string) ?? 'nouveau', supprimer: async () => {}, restaurer: async () => {},
    reessayer: async () => {}, abandonner: async () => {},
    ...actions,
  }
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>
}

export function useDonnees(): ContexteDonnees {
  const c = useContext(Contexte)
  if (!c) throw new Error('useDonnees hors de DonneesProvider')
  return c
}
