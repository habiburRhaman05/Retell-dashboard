"use client";

export function LoadingSkeleton({
  count = 6,
  viewMode = "grid",
}: {
  count?: number;
  viewMode?: "grid" | "list";
}) {
  if (viewMode === "list") {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3.5 rounded-lg border border-gray-100 animate-pulse"
          >
            <div className="w-9 h-9 rounded-lg bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-36 bg-gray-200 rounded" />
              <div className="h-3 w-52 bg-gray-100 rounded" />
            </div>
            <div className="hidden md:flex items-center gap-4">
              <div className="h-3 w-14 bg-gray-100 rounded" />
              <div className="h-3 w-18 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-gray-200 bg-white overflow-hidden animate-pulse"
        >
          <div className="p-5">
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-gray-200 rounded" />
                <div className="h-3 w-44 bg-gray-100 rounded" />
              </div>
            </div>
            <div className="space-y-2.5 mb-4">
              <div className="h-3 w-24 bg-gray-100 rounded" />
              <div className="h-3 w-20 bg-gray-100 rounded" />
              <div className="h-3 w-28 bg-gray-100 rounded" />
            </div>
            <div className="pt-3.5 border-t border-gray-100 flex items-center gap-2">
              <div className="h-5 w-16 bg-gray-100 rounded-full" />
              <div className="h-3 w-6 bg-gray-100 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
