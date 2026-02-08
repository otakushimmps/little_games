/**
 * 全域設定讀取。
 * 請於 Apps Script -> Project Settings -> Script properties 設定必要參數。
 */
const DEFAULT_CONFIG = {
  timezone: 'Asia/Taipei',
  bookingDurationMinutes: 60,
  alternativeDays: 2,
  searchWindowDays: 120,
  serviceBufferMinutes: 15,
};

function getConfig() {
  const props = PropertiesService.getScriptProperties();
  const cfg = {
    lineChannelAccessToken: props.getProperty('LINE_CHANNEL_ACCESS_TOKEN') || '',
    lineChannelSecret: props.getProperty('LINE_CHANNEL_SECRET') || '',
    geminiApiKey: props.getProperty('GEMINI_API_KEY') || '',
    geminiModel: props.getProperty('GEMINI_MODEL') || 'gemini-1.5-flash',
    calendarId: props.getProperty('BOOKING_CALENDAR_ID') || '',
    bookingSpreadsheetId: props.getProperty('BOOKING_SPREADSHEET_ID') || '',
    bookingSheetName: props.getProperty('BOOKING_SHEET_NAME') || 'bookings',
    timezone: props.getProperty('TIMEZONE') || DEFAULT_CONFIG.timezone,
    bookingDurationMinutes: Number(props.getProperty('BOOKING_DURATION_MINUTES') || DEFAULT_CONFIG.bookingDurationMinutes),
    alternativeDays: Number(props.getProperty('ALTERNATIVE_DAYS') || DEFAULT_CONFIG.alternativeDays),
    searchWindowDays: Number(props.getProperty('SEARCH_WINDOW_DAYS') || DEFAULT_CONFIG.searchWindowDays),
    serviceBufferMinutes: Number(props.getProperty('SERVICE_BUFFER_MINUTES') || DEFAULT_CONFIG.serviceBufferMinutes),
  };

  validateConfig(cfg);
  return cfg;
}

function validateConfig(cfg) {
  const required = ['lineChannelAccessToken', 'geminiApiKey', 'calendarId'];
  const missing = required.filter((key) => !cfg[key]);
  if (missing.length > 0) {
    throw new Error('缺少必要設定：' + missing.join(', '));
  }
}

function getLocalNow() {
  return new Date(Utilities.formatDate(new Date(), getConfig().timezone, "yyyy-MM-dd'T'HH:mm:ss"));
}
