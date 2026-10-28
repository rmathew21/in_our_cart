/** The In Our Cart mark: a cart holding a checkmark, with one green and one gold wheel. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 118 100" fill="none" aria-hidden="true" focusable="false" className={className}>
      <path
        d="M6 14 H20 L32 64 H92 L104 26 H23"
        stroke="var(--leaf)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M47 44 L58 54 L80 35" stroke="var(--tag-ink)" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="44" cy="84" r="9" fill="var(--leaf)" />
      <circle cx="82" cy="84" r="9" fill="var(--tag-ink)" />
    </svg>
  );
}

/** Mark + "in our cart" wordmark, used as the page heading. */
export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark className="h-8 w-auto shrink-0" />
      <span className="font-display text-[1.75rem] font-extrabold leading-none tracking-tight">
        in <span className="text-tag-ink">our</span> cart
      </span>
    </span>
  );
}
