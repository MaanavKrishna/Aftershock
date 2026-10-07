export default function Loading() {
  return (
    <main aria-busy="true" className="flex flex-col gap-4 px-8 py-7">
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-80 max-w-full rounded-md bg-[#EDEEE9]" />
      <div className="overflow-hidden rounded-[14px] border border-line bg-white">
        {[70, 55, 80, 60, 72].map((w, i) => (
          <div key={i} className="flex items-center gap-3.5 border-b border-line-soft px-5 py-4">
            <span className="h-3 w-11 rounded bg-[#EDEEE9]" />
            <span className="flex flex-1 flex-col gap-1.5"><span className="h-2.5 rounded bg-[#EDEEE9]" style={{ width: `${w}%` }} /><span className="h-2.5 rounded bg-[#EDEEE9]" style={{ width: `${w / 2}%` }} /></span>
          </div>
        ))}
      </div>
    </main>
  );
}
