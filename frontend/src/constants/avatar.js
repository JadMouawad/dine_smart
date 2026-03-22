// ── Shared default avatar SVG used by UserNav and UserProfile ─────────────────
export const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#C9A227" />
      <stop offset="100%" stop-color="#a07a1e" />
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="64" fill="url(#g)" />
  <circle cx="64" cy="48" r="23" fill="#fff8e1"/>
  <path d="M24 112c5-20 20-31 40-31s35 11 40 31" fill="#fff8e1"/>
</svg>`);
