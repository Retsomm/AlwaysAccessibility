import { useApiLoadingStore } from '../store/apiLoadingStore'

const GlobalLoadingOverlay = () => {
  const pendingCount = useApiLoadingStore((state) => state.pendingCount)

  if (pendingCount === 0) return null

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-white/50 backdrop-blur-[1px]">
      <div className="rounded-2xl bg-white p-4 shadow-xl ring-1 ring-gray-200">
        <div
          className="h-8 w-8 animate-spin rounded-full border-[3px] border-sky-200 border-t-sky-600"
          aria-label="載入中"
        />
      </div>
    </div>
  )
}

export default GlobalLoadingOverlay
