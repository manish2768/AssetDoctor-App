/**
 * Expected Firebase Phone Auth SMS copy (configure in Firebase Console).
 * Android may append a one-line SMS Retriever app hash after the message — keep it on its own line.
 */

export const SMS_OTP_TEMPLATE = {
  /** Console → Authentication → Templates → SMS verification */
  consoleBody:
    'Your Asset Doctor verification code is: %CODE%. Valid for 10 minutes.',
  /** Example user-facing preview (hash on separate line) */
  previewExample:
    'Your Asset Doctor verification code is: 550066. Valid for 10 minutes.\n\n<app-hash>',
  userHint:
    'You will receive an SMS like: “Your Asset Doctor verification code is: ######. Valid for 10 minutes.”',
  ttlMinutes: 10,
};

export default SMS_OTP_TEMPLATE;
