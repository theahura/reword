export function initGA(measurementId) {
  if (!measurementId) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', measurementId, { send_page_view: true });
}

export function trackEvent(eventName, params) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', eventName, params);
}
