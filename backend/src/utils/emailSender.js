const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || "587", 10),
  secure: process.env.EMAIL_SECURE === "true",
  family: 4,
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

const sendPasswordResetEmail = async (to, resetLink, userName = "User") => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reset your password - DineSmart</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Reset your password</h2>
      <p>Hi ${userName},</p>
      <p>We received a request to reset your DineSmart password.</p>
      <p style="margin: 24px 0;">
        <a href="${resetLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #666;">${resetLink}</p>
      <p>This link will expire in 1 hour. If you didn't request this reset, you can safely ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="font-size: 12px; color: #888;">DineSmart - Account security</p>
    </body>
    </html>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || "noreply@dinesmart.com",
    to,
    subject: "Reset your DineSmart password",
    html,
  };

  await transporter.sendMail(mailOptions);
};

const sendReservationConfirmationEmail = async ({
  to,
  userName = "Guest",
  restaurantName,
  reservationDate,
  reservationTime,
  reservationEndTime,
  durationMinutes,
  partySize,
  confirmationId,
  seatingPreference,
  specialRequest,
}) => {
  const safeRestaurant = restaurantName || "N/A";
  const safeDate = reservationDate || "N/A";
  const safeTime = reservationTime || "N/A";
  const timeLabel = reservationEndTime ? `${safeTime} – ${reservationEndTime}` : safeTime;
  const durationLabel = durationMinutes ? ` (${durationMinutes >= 60 ? `${durationMinutes / 60}h` : `${durationMinutes}min`})` : "";
  const safePartySize = partySize != null ? partySize : "N/A";
  const safeConfirmationId = confirmationId || "N/A";
  const seatingLine = seatingPreference ? `<p><strong>Seating:</strong> ${seatingPreference}</p>` : "";
  const specialRequestLine = specialRequest
    ? `<p><strong>Special request:</strong> ${specialRequest}</p>`
    : "";

  const textBody =
    `Hi ${userName},\n\n` +
    `Your reservation has been confirmed. Please keep your confirmation ID for check-in.\n\n` +
    `Confirmation ID: ${safeConfirmationId}\n` +
    `Restaurant: ${safeRestaurant}\n` +
    `Date: ${safeDate}\n` +
    `Time: ${timeLabel}${durationLabel}\n` +
    `Party size: ${safePartySize}\n`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reservation Confirmed</title>
    </head>
    <body style="margin:0; padding:0; font-family: Arial, sans-serif; color:#222;">
      <div style="max-width:600px; margin:0 auto; padding:24px 22px;">
        <h1 style="margin:0 0 18px; font-size:26px; font-weight:700;">Reservation Confirmed</h1>
        <p style="margin:0 0 12px; font-size:16px;">Hi ${userName},</p>
        <p style="margin:0 0 18px; font-size:16px;">
          Your reservation has been confirmed. Please keep your confirmation ID for check-in.
        </p>

        <p style="margin:0 0 10px; font-size:16px;">
          <strong>Confirmation ID:</strong> ${safeConfirmationId}
        </p>
        <p style="margin:0 0 10px; font-size:16px;">
          <strong>Restaurant:</strong> ${safeRestaurant}
        </p>
        <p style="margin:0 0 10px; font-size:16px;">
          <strong>Date:</strong> ${safeDate}
        </p>
        <p style="margin:0 0 10px; font-size:16px;">
          <strong>Time:</strong> ${timeLabel}${durationLabel}
        </p>
        <p style="margin:0; font-size:16px;">
          <strong>Party size:</strong> ${safePartySize}
        </p>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || "noreply@dinesmart.com",
    to,
    subject: "Reservation Confirmed",
    html,
    text: `Reservation Confirmed\n\n${textBody}`,
  };

  await transporter.sendMail(mailOptions);
};

const sendReservationUpdatedEmail = async ({
  to,
  userName = "Guest",
  restaurantName,
  reservationDate,
  reservationTime,
  reservationEndTime,
  durationMinutes,
  partySize,
  confirmationId,
  seatingPreference,
  specialRequest,
}) => {
  const safeRestaurant = restaurantName || "N/A";
  const safeDate = reservationDate || "N/A";
  const safeTime = reservationTime || "N/A";
  const timeLabel = reservationEndTime ? `${safeTime} – ${reservationEndTime}` : safeTime;
  const durationLabel = durationMinutes ? ` (${durationMinutes >= 60 ? `${durationMinutes / 60}h` : `${durationMinutes}min`})` : "";
  const safePartySize = partySize != null ? partySize : "N/A";
  const safeConfirmationId = confirmationId || "N/A";
  const seatingLine = seatingPreference ? `<p><strong>Seating:</strong> ${seatingPreference}</p>` : "";
  const specialRequestLine = specialRequest ? `<p><strong>Special request:</strong> ${specialRequest}</p>` : "";

  const textBody =
    `Hi ${userName},\n\n` +
    `Your reservation has been updated and is now pending re-confirmation by the restaurant.\n\n` +
    `Confirmation ID: ${safeConfirmationId}\n` +
    `Restaurant: ${safeRestaurant}\n` +
    `Date: ${safeDate}\n` +
    `Time: ${timeLabel}${durationLabel}\n` +
    `Party size: ${safePartySize}\n`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reservation Updated</title>
    </head>
    <body style="margin:0; padding:0; font-family: Arial, sans-serif; color:#222;">
      <div style="max-width:600px; margin:0 auto; padding:24px 22px;">
        <h1 style="margin:0 0 18px; font-size:26px; font-weight:700;">Reservation Updated</h1>
        <p style="margin:0 0 12px; font-size:16px;">Hi ${userName},</p>
        <p style="margin:0 0 18px; font-size:16px;">
          Your reservation has been updated and is now pending re-confirmation by the restaurant.
        </p>
        <p style="margin:0 0 10px; font-size:16px;">
          <strong>Confirmation ID:</strong> ${safeConfirmationId}
        </p>
        <p style="margin:0 0 10px; font-size:16px;">
          <strong>Restaurant:</strong> ${safeRestaurant}
        </p>
        <p style="margin:0 0 10px; font-size:16px;">
          <strong>Date:</strong> ${safeDate}
        </p>
        <p style="margin:0 0 10px; font-size:16px;">
          <strong>Time:</strong> ${timeLabel}${durationLabel}
        </p>
        <p style="margin:0 0 10px; font-size:16px;">
          <strong>Party size:</strong> ${safePartySize}
        </p>
        ${seatingLine}
        ${specialRequestLine}
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || "noreply@dinesmart.com",
    to,
    subject: "Reservation Updated",
    html,
    text: `Reservation Updated\n\n${textBody}`,
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

const sendReservationCancelledForEventEmail = async ({
  to,
  userName = "Guest",
  restaurantName,
  reservationDate,
  reservationTime,
  eventTitle,
}) => {
  const safeRestaurant = restaurantName || "your restaurant";
  const safeDate = reservationDate || "the scheduled date";
  const safeTime = reservationTime || "the scheduled time";
  const safeEventTitle = eventTitle || "an event";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reservation update - DineSmart</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Reservation Cancelled</h2>
      <p>Hi ${userName},</p>
      <p>We wanted to let you know that your reservation at <strong>${safeRestaurant}</strong> has been cancelled because the restaurant scheduled <strong>${safeEventTitle}</strong> during that time.</p>
      <p><strong>Date:</strong> ${safeDate}</p>
      <p><strong>Time:</strong> ${safeTime}</p>
      <p>We know plan changes are frustrating, and we’re sorry for the inconvenience. Please feel free to choose another available time slot in DineSmart.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="font-size: 12px; color: #888;">DineSmart - Reservation update</p>
    </body>
    </html>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || "noreply@dinesmart.com",
    to,
    subject: "Your DineSmart reservation was cancelled due to an event",
    html,
  };

  await transporter.sendMail(mailOptions);
};

const sendNoShowWarningEmail = async ({ to, userName = "Guest" }) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>No-show warning - DineSmart</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Reservation No-show Warning</h2>
      <p>Hi ${userName},</p>
      <p>We noticed that you missed two reservations on DineSmart.</p>
      <p>Please note that you have <strong>one remaining chance</strong> before a temporary booking ban is applied.</p>
      <p>If you can’t make a reservation, please cancel ahead of time so we can keep schedules accurate for everyone.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="font-size: 12px; color: #888;">DineSmart - Reservation reminders</p>
    </body>
    </html>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || "noreply@dinesmart.com",
    to,
    subject: "Important: Reservation no-show warning",
    html,
  };

  await transporter.sendMail(mailOptions);
};

const sendNoShowBanEmail = async ({ to, userName = "Guest", bannedUntilLabel }) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Booking ban notice - DineSmart</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Temporary Booking Ban</h2>
      <p>Hi ${userName},</p>
      <p>Because of multiple reservation no-shows, your account has been temporarily restricted from booking.</p>
      <p><strong>Ban duration:</strong> until ${bannedUntilLabel}</p>
      <p>You can book again after this date. If you believe this was a mistake, please contact support.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="font-size: 12px; color: #888;">DineSmart - Reservation updates</p>
    </body>
    </html>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || "noreply@dinesmart.com",
    to,
    subject: "Your DineSmart booking access is temporarily restricted",
    html,
  };

  await transporter.sendMail(mailOptions);
};

const sendRestaurantRejectionEmail = async ({
  to,
  ownerName = "Restaurant owner",
  restaurantName,
  rejectionReason,
}) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Restaurant submission update - DineSmart</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Restaurant Submission Update</h2>
      <p>Hi ${ownerName},</p>
      <p>Thank you for submitting <strong>${restaurantName}</strong> to DineSmart. After review, we’re unable to approve it at this time.</p>
      <p><strong>Reason provided:</strong></p>
      <p style="background: #f5f5f5; padding: 12px 16px; border-radius: 8px;">${rejectionReason}</p>
      <p>You’re welcome to update your listing and submit again once these items are addressed.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="font-size: 12px; color: #888;">DineSmart - Restaurant onboarding</p>
    </body>
    </html>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || "noreply@dinesmart.com",
    to,
    subject: "Your restaurant submission update",
    html,
  };

  await transporter.sendMail(mailOptions);
};

const sendRestaurantApprovalEmail = async ({
  to,
  ownerName = "Restaurant owner",
  restaurantName,
}) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Restaurant approved - DineSmart</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Restaurant Approved</h2>
      <p>Hi ${ownerName},</p>
      <p>Your restaurant <strong>${restaurantName}</strong> has been approved on DineSmart.</p>
      <p>Your listing is now active and ready for users to discover and book.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="font-size: 12px; color: #888;">DineSmart - Restaurant onboarding</p>
    </body>
    </html>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || "noreply@dinesmart.com",
    to,
    subject: "Your restaurant has been approved",
    html,
  };

  await transporter.sendMail(mailOptions);
};

const sendWaitlistSlotAvailableEmail = async ({
  to,
  userName = "Guest",
  restaurantName,
  reservationDate,
  reservationTime,
  partySize,
  availableSeats,
}) => {
  const availableLine = Number.isFinite(availableSeats)
    ? `<p><strong>Seats available right now:</strong> ${availableSeats}</p>`
    : "";
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reservation slot available - DineSmart</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>A spot just opened up</h2>
      <p>Hi ${userName},</p>
      <p>Good news! A reservation slot is now available for:</p>
      <p><strong>Restaurant:</strong> ${restaurantName}</p>
      <p><strong>Date:</strong> ${reservationDate}</p>
      <p><strong>Time:</strong> ${reservationTime}</p>
      <p><strong>Party size:</strong> ${partySize}</p>
      ${availableLine}
      <p>Please log in and book as soon as possible. Availability is not guaranteed.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="font-size: 12px; color: #888;">DineSmart - Waitlist updates</p>
    </body>
    </html>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || "noreply@dinesmart.com",
    to,
    subject: "A reservation slot is available",
    html,
  };

  await transporter.sendMail(mailOptions);
};

const sendSubscriptionUpdateEmail = async ({
  to,
  userName = "Guest",
  updateType,
  subject,
  message,
}) => {
  const safeSubject = subject || "DineSmart Updates";
  const typeLabel = updateType ? String(updateType).toUpperCase() : "UPDATE";
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${safeSubject}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <p style="margin: 0 0 12px; font-size: 12px; letter-spacing: 1px; color: #777;">${typeLabel}</p>
      <h2 style="margin: 0 0 16px;">${safeSubject}</h2>
      <p>Hi ${userName},</p>
      <p>${message}</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="font-size: 12px; color: #888;">DineSmart - Updates</p>
    </body>
    </html>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || "noreply@dinesmart.com",
    to,
    subject: safeSubject,
    html,
    text: `${safeSubject}\n\nHi ${userName},\n\n${message}\n`,
  };

  await transporter.sendMail(mailOptions);
};

const sendReviewModerationEmail = async ({
  to,
  userName = "User",
  restaurantName,
  action,
  reviewComment,
  adminNotes,
}) => {
  let subject, message, actionText;

  switch (action) {
    case 'REQUIRE_CHANGES':
      subject = "Your review needs changes - DineSmart";
      actionText = "requires changes";
      message = `
        <p>Your review for <strong>${restaurantName}</strong> has been reviewed by our moderation team and requires some changes before it can be published.</p>
        <p><strong>Your review:</strong> "${reviewComment || 'No comment'}"</p>
        ${adminNotes ? `<p><strong>Moderator notes:</strong> ${adminNotes}</p>` : ''}
        <p>Please log in to your DineSmart account to edit your review. You can find your reviews in your profile section.</p>
      `;
      break;
    case 'APPROVE_PUBLISH':
      subject = "Your review has been approved - DineSmart";
      actionText = "has been approved and published";
      message = `
        <p>Great news! Your review for <strong>${restaurantName}</strong> has been approved and is now published.</p>
        <p><strong>Your review:</strong> "${reviewComment || 'No comment'}"</p>
        <p>Thank you for sharing your dining experience with the DineSmart community!</p>
      `;
      break;
    case 'DELETE':
      subject = "Your review has been removed - DineSmart";
      actionText = "has been removed";
      message = `
        <p>Your review for <strong>${restaurantName}</strong> has been reviewed and removed from DineSmart.</p>
        <p><strong>Your review:</strong> "${reviewComment || 'No comment'}"</p>
        ${adminNotes ? `<p><strong>Reason:</strong> ${adminNotes}</p>` : ''}
        <p>If you believe this was a mistake, please contact our support team.</p>
      `;
      break;
    default:
      return; // Don't send email for DISMISS action
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Review Moderation Update</h2>
      <p>Hi ${userName},</p>
      ${message}
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="font-size: 12px; color: #888;">DineSmart - Review moderation</p>
    </body>
    </html>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || "noreply@dinesmart.com",
    to,
    subject,
    html,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendReservationConfirmationEmail,
  sendReservationUpdatedEmail,
  sendReservationCancellationEmail,
  sendReservationCancelledForEventEmail,
  sendNoShowWarningEmail,
  sendNoShowBanEmail,
  sendRestaurantApprovalEmail,
  sendRestaurantRejectionEmail,
  sendWaitlistSlotAvailableEmail,
  sendSubscriptionUpdateEmail,
  sendReviewModerationEmail,
};
