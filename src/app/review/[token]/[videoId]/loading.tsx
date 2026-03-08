export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header skeleton */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-16 h-4 bg-gray-800 rounded animate-pulse" />
          <div className="w-6 h-6 bg-gray-800 rounded-lg animate-pulse" />
          <div>
            <div className="w-32 h-3.5 bg-gray-800 rounded animate-pulse mb-1" />
            <div className="w-20 h-3 bg-gray-700 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="w-20 h-9 bg-gray-800 rounded-lg animate-pulse" />
          <div className="w-20 h-9 bg-gray-800 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
        {/* Video area */}
        <div className="flex-1 bg-black flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-gray-600">
            <div className="w-12 h-12 border-4 border-gray-800 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-sm">読み込み中...</p>
          </div>
        </div>

        {/* Sidebar skeleton */}
        <div className="w-full lg:w-96 bg-gray-900 border-l border-gray-800 p-4 space-y-3">
          <div className="w-full h-24 bg-gray-800 rounded-lg animate-pulse" />
          <div className="w-full h-8 bg-gray-800 rounded-lg animate-pulse" />
          <div className="w-full h-20 bg-gray-800 rounded-lg animate-pulse" />
          <div className="w-full h-10 bg-gray-800 rounded-lg animate-pulse" />
          <div className="space-y-2 pt-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-full h-16 bg-gray-800 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
