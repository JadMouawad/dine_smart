const loyaltyRepository = require("../repositories/loyaltyRepository");
const voucherService = require("./voucherService");

const POINTS_PER_RESTAURANT_RESERVATION = 10;
const POINTS_PER_EVENT_RESERVATION = 20;
const REWARD_THRESHOLD = 100;
const REWARD_CODE = "voucher_10_off";

const awardPointsForReservation = async ({ userId, reservationId, db }) => {
  return await loyaltyRepository.awardPointsForSource(
    {
      userId,
      sourceType: "reservation",
      sourceId: reservationId,
      points: POINTS_PER_RESTAURANT_RESERVATION,
    },
    db
  );
};

const awardPointsForEvent = async ({ userId, attendeeId, db }) => {
  return await loyaltyRepository.awardPointsForSource(
    {
      userId,
      sourceType: "event",
      sourceId: attendeeId,
      points: POINTS_PER_EVENT_RESERVATION,
    },
    db
  );
};

const reversePointsForReservation = async ({ userId, reservationId, db }) => {
  return await loyaltyRepository.reversePointsForSource(
    {
      userId,
      sourceType: "reservation",
      reversalSourceType: "reservation_cancel",
      sourceId: reservationId,
      points: POINTS_PER_RESTAURANT_RESERVATION,
    },
    db
  );
};

const reversePointsForEvent = async ({ userId, attendeeId, db }) => {
  return await loyaltyRepository.reversePointsForSource(
    {
      userId,
      sourceType: "event",
      reversalSourceType: "event_cancel",
      sourceId: attendeeId,
      points: POINTS_PER_EVENT_RESERVATION,
    },
    db
  );
};

const getRewardStatus = async ({ userId, db }) => {
  const points = await loyaltyRepository.getUserPoints(userId, db);
  return await voucherService.getRewardStatus({ userId, points }, db);
};

const redeemReward = async ({ userId, db }) => {
  const result = await voucherService.redeemVoucher({ userId, db });
  if (!result.success) return result;
  return { success: true, status: 200, points: await loyaltyRepository.getUserPoints(userId, db), voucher: result.voucher };
};

module.exports = {
  POINTS_PER_RESTAURANT_RESERVATION,
  POINTS_PER_EVENT_RESERVATION,
  REWARD_THRESHOLD,
  REWARD_CODE,
  awardPointsForReservation,
  awardPointsForEvent,
  reversePointsForReservation,
  reversePointsForEvent,
  getRewardStatus,
  redeemReward,
};
