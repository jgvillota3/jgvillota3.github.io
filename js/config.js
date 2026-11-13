// Configuración de Home. CLIENT_ID se llena con el ID de cliente OAuth de Google Cloud.
export const CONFIG = {
  CLIENT_ID: '789656987771-f662a4mhrgqph59ukftn19inhh4litk7.apps.googleusercontent.com',
  FIN_ID: '1VX5SVbGV2huCE1jYU9Eb3BuOwuphQaYTUHgbxZdrKnI',
  HOME_SHEET_NAME: 'HOME · datos de la app',
  ALERT_CALENDAR_NAME: 'Home · avisos',
  CARD_BUDGET: 1500000,
  SCOPES: [
    'openid', 'email', 'profile',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/drive.file'
  ].join(' ')
};

// Modo demo: sin CLIENT_ID o con ?demo en la dirección. Usa datos de ejemplo y no toca Google.
export const DEMO = !CONFIG.CLIENT_ID || new URLSearchParams(location.search).has('demo');
