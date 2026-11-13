// Íconos de línea (trazo 1.8), mismos del diseño.
const svg = (d, size = 20, sw = 1.8) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const I = {
  hoy: (s) => svg('<rect x="3" y="9" width="18" height="6" rx="2"></rect><path d="M9 9v6M15 9v6"></path>', s),
  finanzas: (s) => svg('<path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z"></path><path d="M4 7l11-3v3"></path><circle cx="16" cy="13.5" r="1.2"></circle>', s),
  agenda: (s) => svg('<rect x="3.5" y="5" width="17" height="15" rx="2"></rect><path d="M3.5 10h17M8 3v4M16 3v4"></path>', s),
  wellness: (s) => svg('<path d="M3 12h4l2.5-6 5 12 2.5-6h4"></path>', s),
  pendientes: (s) => svg('<rect x="4" y="4" width="16" height="16" rx="3"></rect><path d="M8.5 12l2.5 2.5 4.5-5"></path>', s),
  bell: (s) => svg('<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"></path><path d="M10.3 20a1.9 1.9 0 0 0 3.4 0"></path>', s),
  plus: (s = 20) => svg('<path d="M12 5v14M5 12h14"></path>', s, 2),
  minus: (s = 20) => svg('<path d="M5 12h14"></path>', s, 2),
  check: (s = 14) => svg('<path d="M5 12.5l4.5 4.5L19 7.5"></path>', s, 2.6),
  lock: (s = 14) => svg('<rect x="5" y="11" width="14" height="9" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path>', s, 2),
  card: (s = 18) => svg('<rect x="3" y="6" width="18" height="13" rx="2"></rect><path d="M3 10h18"></path>', s),
  coin: (s = 18) => svg('<path d="M12 3v18"></path><path d="M17 7.5C17 5.6 14.8 4.5 12 4.5S7 5.6 7 7.6s2 2.8 5 3.4 5 1.6 5 3.6-2.2 3.2-5 3.2-5-1.2-5-3.1"></path>', s),
  task: (s = 18) => svg('<rect x="4" y="4" width="16" height="16" rx="3"></rect><path d="M8.5 12l2.5 2.5 4.5-5"></path>', s),
  repeat: (s = 18) => svg('<path d="M17 2l3 3-3 3"></path><path d="M4 11V9a4 4 0 0 1 4-4h12"></path><path d="M7 22l-3-3 3-3"></path><path d="M20 13v2a4 4 0 0 1-4 4H4"></path>', s),
  sync: (s = 15) => svg('<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8"></path><path d="M4 4v4h4"></path><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16"></path><path d="M20 20v-4h-4"></path>', s, 2),
  left: (s = 18) => svg('<path d="M15 5l-7 7 7 7"></path>', s, 2),
  right: (s = 18) => svg('<path d="M9 5l7 7-7 7"></path>', s, 2),
  close: (s = 20) => svg('<path d="M6 6l12 12M18 6L6 18"></path>', s, 2),
  trash: (s = 18) => svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"></path>', s),
  logout: (s = 18) => svg('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"></path><path d="M10 17l-5-5 5-5M5 12h11"></path>', s),
  google: () => `<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`
};
