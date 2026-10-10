export function preparePlatform() {
  document.title = 'To-Dos · A little less on your mind';
  let viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!viewport) { viewport = document.createElement('meta'); viewport.name = 'viewport'; document.head.appendChild(viewport); }
  viewport.content = 'width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content';
  const theme = document.createElement('meta');
  theme.name = 'theme-color';
  theme.content = '#FAF8F4';
  document.head.appendChild(theme);
  const style = document.createElement('style');
  style.textContent = `
    html, body, #root { height: 100%; min-height: 100dvh; background: #FAF8F4; }
    html { -webkit-tap-highlight-color: transparent; -webkit-text-size-adjust: 100%; }
    body { margin: 0; overscroll-behavior: none; }
    input, textarea { font-size: 16px; }
    [role="button"], [role="checkbox"], [role="tab"] { touch-action: manipulation; }
    :focus-visible { outline: 2px solid #A84621 !important; outline-offset: 3px; }
    ::selection { background: #F0D7C7; color: #272B25; }
    @media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
  `;
  document.head.appendChild(style);
}
