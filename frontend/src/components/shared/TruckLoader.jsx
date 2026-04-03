export default function TruckLoader({ className = '' }) {
  return (
    <div className={`flex items-center justify-center py-1 ${className}`}>
      <div className="relative w-40 h-6 overflow-hidden">
        <div className="absolute bottom-0 left-0 right-0 h-px bg-white/20" />
        <svg
          className="absolute bottom-0.5 animate-[truckMove_2s_ease-in-out_infinite] w-7 h-4"
          viewBox="0 0 32 20"
          fill="none"
        >
          <rect x="8" y="4" width="16" height="10" rx="2" fill="#354f52" />
          <rect x="24" y="6" width="7" height="8" rx="1.5" fill="#354f52" />
          <rect x="25.5" y="7.5" width="4" height="3.5" rx="0.75" fill="#f5f1e8" />
          <circle cx="13" cy="16" r="2.5" fill="#354f52" />
          <circle cx="13" cy="16" r="1" fill="#f5f1e8" />
          <circle cx="27" cy="16" r="2.5" fill="#354f52" />
          <circle cx="27" cy="16" r="1" fill="#f5f1e8" />
        </svg>
      </div>
    </div>
  );
}
