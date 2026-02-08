function doGet() {
  return ContentService.createTextOutput('Tammy Booking Bot is running.');
}

function doPost(e) {
  try {
    const events = parseLineEvents(e);
    if (!events.length) {
      return ContentService.createTextOutput('OK');
    }

    events.forEach(handleLineEvent);
    return ContentService.createTextOutput('OK');
  } catch (err) {
    console.error('Webhook error: ' + err.stack);
    return ContentService.createTextOutput('ERROR');
  }
}

function handleLineEvent(event) {
  if (!event || event.type !== 'message' || !event.message || event.message.type !== 'text') {
    return;
  }

  const userId = event.source && event.source.userId;
  const profile = getLineUserProfile(userId);
  const text = event.message.text;
  const ctx = buildUserContext(profile, text);
  ctx.lineUserId = userId;

  const assistantResult = runAssistantConversation(text, ctx);
  const finalText = appendBookingConfirmationMessage(assistantResult, profile);
  replyLineMessage(event.replyToken, [finalText]);
}

function appendBookingConfirmationMessage(assistantResult, profile) {
  const lines = [assistantResult.text];
  const bookingResult = assistantResult.bookingResult;

  if (bookingResult && bookingResult.booking && bookingResult.booking.success) {
    const bk = bookingResult.booking;
    lines.push('');
    lines.push('為您再次確認預約資訊：');
    lines.push('姓名：' + (bk.name || (profile ? profile.displayName : '貴賓')));
    lines.push('日期：' + bk.date);
    lines.push('時段：' + bk.startTime + ' - ' + bk.endTime);
    lines.push('當天請穿著寬鬆的衣服過來喔，這樣退紅速度會更快，也會更舒服喔。');

    if (bookingResult.isPregnant) {
      lines.push('');
      lines.push('孕期貼心建議：');
      lines.push(pregnancySuggestionByWeek(bookingResult.gestationalWeek));
    }
  }

  return lines.join('\n');
}
