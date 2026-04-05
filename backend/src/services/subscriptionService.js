const adminRepository = require("../repositories/adminRepository");
const subscriptionNotificationRepository = require("../repositories/subscriptionNotificationRepository");
const { sendSubscriptionUpdateEmail } = require("../utils/emailSender");

const sendSubscriptionUpdate = async ({ updateType, subject, message }) => {
  const normalizedType = String(updateType || "").trim().toLowerCase();
  if (!["news", "offers", "events"].includes(normalizedType)) {
    return { success: false, status: 400, error: "update_type must be news, offers, or events" };
  }
  const safeSubject = String(subject || "").trim();
  const safeMessage = String(message || "").trim();
  if (!safeSubject) return { success: false, status: 400, error: "subject is required" };
  if (safeMessage.length < 5) return { success: false, status: 400, error: "message is required" };

  const recipients = await adminRepository.getSubscribedUsersByPreference(normalizedType);
  if (!recipients.length) {
    return { success: true, status: 200, data: { sent: 0, total: 0, failed: 0 } };
  }

  let sent = 0;
  let failed = 0;
  await Promise.all(
    recipients.map(async (user) => {
      if (!user.email) return;
      try {
        await sendSubscriptionUpdateEmail({
          to: user.email,
          userName: user.full_name || "Guest",
          updateType: normalizedType,
          subject: safeSubject,
          message: safeMessage,
        });
        sent += 1;
      } catch (error) {
        failed += 1;
      }
    })
  );

  return { success: true, status: 200, data: { sent, total: recipients.length, failed } };
};

const sendSubscriptionUpdateOnce = async ({
  updateType,
  subject,
  message,
  entityType,
  entityId,
  fingerprint,
}) => {
  const normalizedType = String(updateType || "").trim().toLowerCase();
  if (!["news", "offers", "events"].includes(normalizedType)) {
    return { success: false, status: 400, error: "update_type must be news, offers, or events" };
  }
  const safeSubject = String(subject || "").trim();
  const safeMessage = String(message || "").trim();
  if (!safeSubject) return { success: false, status: 400, error: "subject is required" };
  if (safeMessage.length < 5) return { success: false, status: 400, error: "message is required" };
  const safeEntityType = String(entityType || "").trim();
  const safeFingerprint = String(fingerprint || "").trim();
  const parsedEntityId = Number.isFinite(Number(entityId)) ? Number(entityId) : 0;
  if (!safeEntityType || !safeFingerprint) {
    return { success: false, status: 400, error: "entity_type and fingerprint are required" };
  }

  const recorded = await subscriptionNotificationRepository.recordNotification({
    updateType: normalizedType,
    entityType: safeEntityType,
    entityId: parsedEntityId,
    fingerprint: safeFingerprint,
  });
  if (!recorded) {
    return { success: true, status: 200, data: { sent: 0, total: 0, failed: 0, skipped: true } };
  }

  return await sendSubscriptionUpdate({
    updateType: normalizedType,
    subject: safeSubject,
    message: safeMessage,
  });
};

module.exports = {
  sendSubscriptionUpdate,
  sendSubscriptionUpdateOnce,
};
