/**
 * Content Security Policy for builds served without custom headers (GitHub Pages).
 * Same source rules as public/_headers. A meta tag cannot set frame-ancestors, HSTS or
 * X-Frame-Options, so those stay in public/_headers and are a known gap on Pages
 * (see the deployment guide).
 */
export const CSP_POLICY =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co; connect-src 'self' https://*.supabase.co wss://*.supabase.co; font-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'self'; form-action 'self'";

export function cspMetaTag(): string {
  return `<meta http-equiv="Content-Security-Policy" content="${CSP_POLICY}" />`;
}
