const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || "587", 10),
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
});

/**
 * Send verification email with link
 * @param {string} to - Recipient email
 * @param {string} verificationLink - Full URL for verification
 * @param {string} [userName] - Optional user name for personalization
 */
const sendVerificationEmail = async (to, verificationLink, userName = "User") => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Verify your email - DineSmart</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Verify your email address</h2>
      <p>Hi ${userName},</p>
      <p>Thanks for signing up for DineSmart! Please verify your email address by clicking the link below:</p>
      <p style="margin: 24px 0;">
        <a href="${verificationLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Verify Email</a>
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #666;">${verificationLink}</p>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't create an account, you can safely ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="font-size: 12px; color: #888;">DineSmart - Smart dining recommendations</p>
    </body>
    </html>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || "noreply@dinesmart.com",
    to,
    subject: "Verify your email - DineSmart",
    html
  };

  await transporter.sendMail(mailOptions);
};

const sendReservationConfirmationEmail = async ({
  to,
  userName = "Guest",
  restaurantName,
  reservationDate,
  reservationTime,
  partySize,
  confirmationId,
  seatingPreference,
  specialRequest,
}) => {
  const seatingLine = seatingPreference ? `<p><strong>Seating:</strong> ${seatingPreference}</p>` : "";
  const specialRequestLine = specialRequest
    ? `<p><strong>Special request:</strong> ${specialRequest}</p>`
    : "";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reservation confirmed - DineSmart</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Reservation Confirmed</h2>
      <p>Hi ${userName},</p>
      <p>Your reservation has been confirmed. Please keep your confirmation ID for check-in.</p>
      <p><strong>Confirmation ID:</strong> ${confirmationId}</p>
      <p><strong>Restaurant:</strong> ${restaurantName}</p>
      <p><strong>Date:</strong> ${reservationDate}</p>
      <p><strong>Time:</strong> ${reservationTime}</p>
      <p><strong>Party size:</strong> ${partySize}</p>
      ${seatingLine}
      ${specialRequestLine}
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="font-size: 12px; color: #888;">DineSmart - Reservation confirmation</p>
    </body>
    </html>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || "noreply@dinesmart.com",
    to,
    subject: "Your DineSmart reservation is confirmed",
    html,
  };

  await transporter.sendMail(mailOptions);
};

const sendReservationCancellationEmail = async ({
  to,
  userName = "Guest",
  restaurantName,
  reservationDate,
  reservationTime,
  partySize,
  confirmationId,
}) => {
  const confirmationLine = confirmationId
    ? `<p><strong>Confirmation ID:</strong> ${confirmationId}</p>`
    : "";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reservation cancelled - DineSmart</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Reservation Cancelled</h2>
      <p>Hi ${userName},</p>
      <p>Your reservation has been cancelled successfully.</p>
      ${confirmationLine}
      <p><strong>Restaurant:</strong> ${restaurantName}</p>
      <p><strong>Date:</strong> ${reservationDate}</p>
      <p><strong>Time:</strong> ${reservationTime}</p>
      <p><strong>Seats:</strong> ${partySize}</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="font-size: 12px; color: #888;">DineSmart - Reservation update</p>
    </body>
    </html>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || "noreply@dinesmart.com",
    to,
    subject: "Your DineSmart reservation was cancelled",
    html,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = {
  sendVerificationEmail,
  sendReservationConfirmationEmail,
  sendReservationCancellationEmail,
};
