"use client";

export function StatTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-[13px] font-semibold text-gray-800 mb-3">{label}</h3>
      <div className="bg-gray-50 rounded-lg h-24 flex items-center justify-center">
        <span className="text-[28px] font-semibold text-gray-900">{value}</span>
      </div>
    </div>
  );
}
