export function Splitter({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  function clamp(value: number) { return Math.max(25, Math.min(75, value)); }
  return <div className="splitter" role="separator" tabIndex={0} aria-label="Resize editor and results" aria-orientation="vertical" aria-valuemin={25} aria-valuemax={75} aria-valuenow={Math.round(value)}
    onKeyDown={(event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); onChange(clamp(value + (event.key === "ArrowRight" ? 2 : -2))); } }}
    onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); }}
    onPointerMove={(event) => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) return; const rect = event.currentTarget.parentElement!.getBoundingClientRect(); onChange(clamp((event.clientX - rect.left) / rect.width * 100)); }}
    onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)} />;
}
