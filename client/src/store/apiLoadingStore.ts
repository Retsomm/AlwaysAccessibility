import { create } from 'zustand'

interface ApiLoadingState {
  pendingCount: number
  startRequest: () => void
  finishRequest: () => void
}

export const useApiLoadingStore = create<ApiLoadingState>((set) => ({
  pendingCount: 0,
  startRequest: () => set((state) => ({ pendingCount: state.pendingCount + 1 })),
  finishRequest: () =>
    set((state) => ({
      pendingCount: Math.max(0, state.pendingCount - 1),
    })),
}))
