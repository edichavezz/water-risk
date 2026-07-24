import { create } from 'zustand'
import type { UserType, Language, RiskProfile, SearchResult } from '../types'

interface AppStore {
  language: Language
  userType: UserType
  profile: RiskProfile | null
  activeLayers: {
    flood: boolean
    drought: boolean
    reservoirs: boolean
  }

  setLanguage: (lang: Language) => void
  setUserType: (type: UserType) => void
  setProfile: (profile: RiskProfile | null) => void
  updateProfile: (partial: Partial<RiskProfile>) => void
  toggleLayer: (layer: 'flood' | 'drought' | 'reservoirs') => void
}

export const useAppStore = create<AppStore>((set) => ({
  language: 'en',
  userType: 'buyer',
  profile: null,
  activeLayers: {
    flood: true,
    drought: true,
    reservoirs: true,
  },

  setLanguage: (language) => set({ language }),
  setUserType: (userType) => set({ userType }),
  setProfile: (profile) => set({ profile }),
  updateProfile: (partial) =>
    set((state) =>
      state.profile ? { profile: { ...state.profile, ...partial } } : {}
    ),
  toggleLayer: (layer) =>
    set((state) => ({
      activeLayers: {
        ...state.activeLayers,
        [layer]: !state.activeLayers[layer],
      },
    })),
}))
