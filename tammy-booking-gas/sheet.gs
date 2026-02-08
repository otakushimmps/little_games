const BOOKING_SHEET_HEADERS = [
  'bookingId',
  'status',
  'customerName',
  'lineUserId',
  'serviceType',
  'isPregnant',
  'gestationalWeek',
  'date',
  'startTime',
  'endTime',
  'notes',
  'reason',
  'createdAt',
  'updatedAt',
];

function getBookingSheet() {
  const cfg = getConfig();
  if (!cfg.bookingSpreadsheetId) {
    return null;
  }

  const ss = SpreadsheetApp.openById(cfg.bookingSpreadsheetId);
  let sheet = ss.getSheetByName(cfg.bookingSheetName);
  if (!sheet) {
    sheet = ss.insertSheet(cfg.bookingSheetName);
  }

  ensureBookingSheetHeader(sheet);
  return sheet;
}

function ensureBookingSheetHeader(sheet) {
  const current = sheet.getRange(1, 1, 1, BOOKING_SHEET_HEADERS.length).getValues()[0];
  const needInit = BOOKING_SHEET_HEADERS.some(function(h, i) { return current[i] !== h; });
  if (needInit) {
    sheet.getRange(1, 1, 1, BOOKING_SHEET_HEADERS.length).setValues([BOOKING_SHEET_HEADERS]);
  }
}

function upsertBookingSheetRecord(record) {
  const sheet = getBookingSheet();
  if (!sheet || !record || !record.bookingId) {
    return;
  }

  const now = Utilities.formatDate(new Date(), getConfig().timezone, 'yyyy-MM-dd HH:mm:ss');
  const values = sheet.getDataRange().getValues();
  let targetRow = -1;

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(record.bookingId)) {
      targetRow = i + 1;
      break;
    }
  }

  const row = [
    record.bookingId,
    record.status || 'booked',
    record.customerName || '',
    record.lineUserId || '',
    record.serviceType || '',
    record.isPregnant ? '是' : '否',
    record.gestationalWeek || '',
    record.date || '',
    record.startTime || '',
    record.endTime || '',
    record.notes || '',
    record.reason || '',
    record.createdAt || now,
    now,
  ];

  if (targetRow > 0) {
    const prevCreatedAt = values[targetRow - 1][12];
    row[12] = prevCreatedAt || row[12];
    sheet.getRange(targetRow, 1, 1, BOOKING_SHEET_HEADERS.length).setValues([row]);
    return;
  }

  sheet.appendRow(row);
}

function markBookingSheetCancelled(bookingId, reason) {
  const sheet = getBookingSheet();
  if (!sheet || !bookingId) {
    return;
  }

  const values = sheet.getDataRange().getValues();
  const now = Utilities.formatDate(new Date(), getConfig().timezone, 'yyyy-MM-dd HH:mm:ss');
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(bookingId)) {
      values[i][1] = 'cancelled';
      values[i][11] = reason || '';
      values[i][13] = now;
      sheet.getRange(i + 1, 1, 1, BOOKING_SHEET_HEADERS.length).setValues([values[i]]);
      return;
    }
  }

  upsertBookingSheetRecord({
    bookingId: bookingId,
    status: 'cancelled',
    reason: reason || '',
  });
}
