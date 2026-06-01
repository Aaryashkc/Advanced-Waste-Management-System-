export default function TruckLoader({
  className = '',
  text = '',
  size = 'md',
  colorClass = 'text-primary',
  windowColor = 'var(--dash-card, var(--app-surface, #ffffff))'
}) {
  const sizes = {
    sm: { container: 'w-24 h-4', svg: 'w-5 h-3' },
    md: { container: 'w-40 h-6', svg: 'w-7 h-4' },
    lg: { container: 'w-56 h-8', svg: 'w-9.5 h-5.5' }
  };

  const currentSize = sizes[size] || sizes.md;

  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-3 ${className}`}>
      <div className={`relative overflow-hidden ${currentSize.container}`}>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-primary/10 dark:bg-white/10" />
        <svg
          className={`absolute bottom-0.5 animate-[truckMove_2s_ease-in-out_infinite] ${currentSize.svg} ${colorClass}`}
          viewBox="0 0 32 20"
          fill="none"
        >
          <rect x="8" y="4" width="16" height="10" rx="2" fill="currentColor" />
          <rect x="24" y="6" width="7" height="8" rx="1.5" fill="currentColor" />
          <rect x="25.5" y="7.5" width="4" height="3.5" rx="0.75" fill={windowColor} />
          <circle cx="13" cy="16" r="2.5" fill="currentColor" />
          <circle cx="13" cy="16" r="1" fill={windowColor} />
          <circle cx="27" cy="16" r="2.5" fill="currentColor" />
          <circle cx="27" cy="16" r="1" fill={windowColor} />
        </svg>
      </div>
      {text && (
        <span className="text-xs font-semibold tracking-wide text-primary/60 dark:text-primary/70 animate-pulse text-center max-w-xs select-none font-sans">
          {text}
        </span>
      )}
    </div>
  );
}
