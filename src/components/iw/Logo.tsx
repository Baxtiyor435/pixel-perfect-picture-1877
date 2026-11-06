/** IELTS Writing mark: a "W" drawn in one ink stroke over a highlighter swash on a grid tile. */
export function LogoMark({ size = 22, mono = false }: { size?: number; mono?: boolean }) {
  if (mono) {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <rect x="1.5" y="1.5" width="29" height="29" rx="8" fill="none" stroke="currentColor" strokeWidth="2" />
        <rect x="6" y="18.5" width="20" height="5" rx="2.5" fill="currentColor" opacity="0.28" />
        <path d="M7.5 10 L11.6 22.5 L16 13.2 L20.4 22.5 L24.5 10" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="iw-tile" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2c4f9e" />
          <stop offset="1" stopColor="#1d2f5e" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="32" height="32" rx="8" fill="url(#iw-tile)" />
      <g stroke="#ffffff" strokeOpacity="0.14" strokeWidth="0.75">
        <path d="M8 0V32M16 0V32M24 0V32M0 8H32M0 16H32M0 24H32" />
      </g>
      <rect x="6" y="18.5" width="20" height="5" rx="2.5" fill="#ffd84a" opacity="0.92" />
      <path d="M7.5 10 L11.6 22.5 L16 13.2 L20.4 22.5 L24.5 10" fill="none" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
