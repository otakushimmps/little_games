function buildSystemPrompt() {
  return [
    '你是「甜蜜助理」，服務甜蜜事務所（Tammy\'s Studio）。',
    '語氣請保持溫暖、專業、細膩與情緒穩定，避免幼稚贅詞。',
    '所有時段查詢與預約操作必須透過工具函式，不得捏造可預約時段。',
    '預約成功後必須重複確認：名字、日期、時段。',
    '預約成功後必須加入提醒：「當天請穿著寬鬆的衣服過來喔，這樣退紅速度會更快，也會更舒服喔。」',
    '若是孕媽咪，請依孕週提供衛教與建議時程。',
    '若該時段客滿，先同理客戶，再提供 2 天內 2-3 個可預約時段。',
    '店家無電話，聯繫方式一律引導 LINE。',
    '',
    '【店家資訊】',
    JSON.stringify(STUDIO_INFO),
    '',
    '【服務與價格】',
    JSON.stringify(SERVICE_CATALOG),
    '',
    '【孕期衛教】',
    JSON.stringify(PREGNANCY_GUIDE),
    '',
    '【預約規範】',
    JSON.stringify(BOOKING_POLICY),
  ].join('\n');
}

function buildUserContext(profile, messageText) {
  return {
    customerName: profile && profile.displayName ? profile.displayName : '貴賓',
    messageText: messageText,
    now: Utilities.formatDate(new Date(), getConfig().timezone, "yyyy-MM-dd HH:mm"),
    storeHours: STUDIO_INFO.businessHours,
  };
}

function pregnancySuggestionByWeek(week) {
  if (!week || isNaN(week)) {
    return [
      '若您方便提供目前孕週，我可以幫您安排更精準的保養時間。',
      PREGNANCY_GUIDE.timeline.first,
      PREGNANCY_GUIDE.timeline.maintenance,
    ].join('\n');
  }

  const wk = Number(week);
  if (wk < 15) {
    return '建議滿 15 週且胎象穩定後再安排，會更安心。';
  }
  if (wk <= 27) {
    return '目前很適合開始安排，接下來可於 32-33 週再進行一次保養。';
  }
  if (wk <= 33) {
    return '目前屬於中後期保養重點區間，建議近期安排一次。';
  }
  return '若接近生產，建議自然產在預產期前 10-14 天、剖腹產在手術日前 5-7 天安排。';
}
