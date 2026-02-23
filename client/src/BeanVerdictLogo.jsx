// Logo: coffee bean + verdict (scale/gavel)
export function BeanVerdictLogo({ className = '' }) {
  return (
    <span className={`bean-verdict-logo ${className}`} aria-hidden>
      <svg viewBox="0 0 48 24" className="bean-verdict-svg" aria-hidden>
        {/* Coffee bean - oval with center seam */}
        <ellipse cx="10" cy="12" rx="7" ry="9" transform="rotate(-25 10 12)" fill="currentColor" opacity="0.85" />
        <path d="M6 10 Q10 8 14 11 Q10 16 6 14 Z" fill="currentColor" opacity="0.5" />
        {/* Verdict - balance scale */}
        <line x1="28" y1="6" x2="44" y2="6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="36" y1="6" x2="36" y2="20" stroke="currentColor" strokeWidth="1" />
        <line x1="32" y1="11" x2="36" y2="6" stroke="currentColor" strokeWidth="1" />
        <line x1="40" y1="11" x2="36" y2="6" stroke="currentColor" strokeWidth="1" />
        <circle cx="32" cy="13" r="1.2" fill="currentColor" />
        <circle cx="40" cy="13" r="1.2" fill="currentColor" />
      </svg>
    </span>
  );
}
