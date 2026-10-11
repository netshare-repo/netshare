// Twilio Message resource: https://www.twilio.com/docs/messaging/api/message-resource
export const smsAvailable = () => /^AC[0-9a-f]{32}$/i.test(process.env.TWILIO_ACCOUNT_SID || '') &&
  Boolean(process.env.TWILIO_AUTH_TOKEN) && /^\+[1-9]\d{7,14}$/.test(process.env.TWILIO_FROM || '');
export const sendSmsOtp = async (to, otp, purpose, fetchImpl = fetch) => {
  if (!smsAvailable()) throw Object.assign(new Error('SMS verification is unavailable; configure the SMS provider'), { status: 503 });
  const sid = process.env.TWILIO_ACCOUNT_SID;
  try {
    const response = await fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM,
        Body: `NetShare ${purpose} code: ${otp}. Expires in 10 minutes. Do not share this code.` }).toString(),
    });
    const body = await response.json();
    if (!response.ok || typeof body.sid !== 'string' || !['accepted', 'queued', 'sending', 'sent', 'delivered'].includes(body.status)) throw new Error('Rejected');
    return { accepted: true };
  } catch { throw Object.assign(new Error('SMS provider did not accept verification delivery; retry later'), { status: 503 }); }
};
