function getBookingCalendar() {
  const cfg = getConfig();
  const calendar = CalendarApp.getCalendarById(cfg.calendarId);
  if (!calendar) {
    throw new Error('找不到指定的 Google Calendar，請確認 BOOKING_CALENDAR_ID。');
  }
  return calendar;
}

function parseDateTime(dateStr, timeStr) {
  const cfg = getConfig();
  const iso = dateStr + 'T' + timeStr + ':00';
  const localString = Utilities.formatDate(new Date(iso), cfg.timezone, "yyyy/MM/dd HH:mm:ss");
  return new Date(localString);
}

function addMinutes(dateObj, minutes) {
  return new Date(dateObj.getTime() + minutes * 60 * 1000);
}

function checkAvailability(args) {
  const cfg = getConfig();
  const start = parseDateTime(args.date, args.startTime);
  const end = addMinutes(start, cfg.bookingDurationMinutes);
  const calendar = getBookingCalendar();
  const events = calendar.getEvents(start, end);
  return {
    available: events.length === 0,
    start: start.toISOString(),
    end: end.toISOString(),
    conflictCount: events.length,
  };
}

function findAlternativeSlots(args) {
  const cfg = getConfig();
  const date = args.date;
  const startTime = args.startTime;
  const days = Number(args.days || cfg.alternativeDays);
  const start = parseDateTime(date, startTime);
  const options = [];

  for (let d = 0; d <= days; d++) {
    const dayBase = addMinutes(start, d * 24 * 60);
    for (let hour = 9; hour <= 20; hour++) {
      const slotStart = new Date(dayBase);
      slotStart.setHours(hour, 0, 0, 0);
      const slotEnd = addMinutes(slotStart, cfg.bookingDurationMinutes);
      const events = getBookingCalendar().getEvents(slotStart, slotEnd);
      if (events.length === 0) {
        options.push({
          date: Utilities.formatDate(slotStart, cfg.timezone, 'yyyy-MM-dd'),
          startTime: Utilities.formatDate(slotStart, cfg.timezone, 'HH:mm'),
          endTime: Utilities.formatDate(slotEnd, cfg.timezone, 'HH:mm'),
        });
      }
      if (options.length >= 3) {
        return { alternatives: options };
      }
    }
  }

  return { alternatives: options };
}

function createBooking(args) {
  const cfg = getConfig();
  const start = parseDateTime(args.date, args.startTime);
  const end = addMinutes(start, cfg.bookingDurationMinutes);

  const available = checkAvailability(args);
  if (!available.available) {
    return { success: false, reason: 'slot_unavailable', alternatives: findAlternativeSlots(args).alternatives };
  }

  const eventTitle = '[甜蜜事務所] ' + args.name + ' - ' + args.serviceType;
  const description = [
    'LINE UID: ' + (args.lineUserId || ''),
    '孕週: ' + (args.gestationalWeek || '未提供'),
    '是否孕媽咪: ' + (args.isPregnant ? '是' : '否'),
    '備註: ' + (args.notes || '無'),
    '建立時間: ' + Utilities.formatDate(new Date(), cfg.timezone, 'yyyy-MM-dd HH:mm:ss'),
  ].join('\n');

  const event = getBookingCalendar().createEvent(eventTitle, start, end, {
    description: description,
  });

  upsertBookingSheetRecord({
    bookingId: event.getId(),
    status: 'booked',
    customerName: args.name,
    lineUserId: args.lineUserId,
    serviceType: args.serviceType,
    isPregnant: !!args.isPregnant,
    gestationalWeek: args.gestationalWeek || '',
    date: Utilities.formatDate(start, cfg.timezone, 'yyyy-MM-dd'),
    startTime: Utilities.formatDate(start, cfg.timezone, 'HH:mm'),
    endTime: Utilities.formatDate(end, cfg.timezone, 'HH:mm'),
    notes: args.notes || '',
  });

  return {
    success: true,
    bookingId: event.getId(),
    name: args.name,
    date: Utilities.formatDate(start, cfg.timezone, 'yyyy-MM-dd'),
    startTime: Utilities.formatDate(start, cfg.timezone, 'HH:mm'),
    endTime: Utilities.formatDate(end, cfg.timezone, 'HH:mm'),
  };
}

function rescheduleBooking(args) {
  const cfg = getConfig();
  const event = CalendarApp.getEventById(args.bookingId);
  if (!event) {
    return { success: false, reason: 'booking_not_found' };
  }

  const availability = checkAvailability({ date: args.newDate, startTime: args.newStartTime });
  if (!availability.available) {
    return {
      success: false,
      reason: 'slot_unavailable',
      alternatives: findAlternativeSlots({ date: args.newDate, startTime: args.newStartTime, days: cfg.alternativeDays }).alternatives,
    };
  }

  const start = parseDateTime(args.newDate, args.newStartTime);
  const end = addMinutes(start, cfg.bookingDurationMinutes);
  event.setTime(start, end);
  upsertBookingSheetRecord({
    bookingId: event.getId(),
    status: 'rescheduled',
    date: Utilities.formatDate(start, cfg.timezone, 'yyyy-MM-dd'),
    startTime: Utilities.formatDate(start, cfg.timezone, 'HH:mm'),
    endTime: Utilities.formatDate(end, cfg.timezone, 'HH:mm'),
  });
  return {
    success: true,
    bookingId: event.getId(),
    date: Utilities.formatDate(start, cfg.timezone, 'yyyy-MM-dd'),
    startTime: Utilities.formatDate(start, cfg.timezone, 'HH:mm'),
  };
}

function cancelBooking(args) {
  const event = CalendarApp.getEventById(args.bookingId);
  if (!event) {
    return { success: false, reason: 'booking_not_found' };
  }
  event.deleteEvent();
  markBookingSheetCancelled(args.bookingId, args.reason || '');
  return { success: true, bookingId: args.bookingId, reason: args.reason || '' };
}

function getBookingByUser(args) {
  const cfg = getConfig();
  const calendar = getBookingCalendar();
  const now = new Date();
  const end = addMinutes(now, cfg.searchWindowDays * 24 * 60);
  const events = calendar.getEvents(now, end);

  const matched = events
    .filter(function(ev) { return (ev.getDescription() || '').indexOf('LINE UID: ' + args.lineUserId) >= 0; })
    .map(function(ev) {
      return {
        bookingId: ev.getId(),
        title: ev.getTitle(),
        date: Utilities.formatDate(ev.getStartTime(), cfg.timezone, 'yyyy-MM-dd'),
        startTime: Utilities.formatDate(ev.getStartTime(), cfg.timezone, 'HH:mm'),
      };
    });

  return { bookings: matched };
}
