"use client";

/**
 * Anchor that forwards the current page's ?ref=<email> onto its target.
 *
 * Corpus pages are static, so a referrer's `ref` cannot be baked into the
 * server-rendered HTML — it only exists in the visitor's URL. When that
 * visitor clicks onward to the calculator, the ref would otherwise be lost
 * and the referral would silently stop being attributed. This tiny client
 * wrapper carries it across the hop.
 */
export function RefLink({
  href,
  className,
  children,
  "aria-label": ariaLabel,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    let ref = "";
    try {
      ref = new URLSearchParams(window.location.search).get("ref") || "";
    } catch {
      // no location; navigate as-is
    }
    if (ref) {
      e.preventDefault();
      const sep = href.includes("?") ? "&" : "?";
      window.location.href = `${href}${sep}ref=${encodeURIComponent(ref)}`;
    }
  };
  return (
    <a href={href} className={className} onClick={onClick} aria-label={ariaLabel}>
      {children}
    </a>
  );
}