const loyaltyRepository = require("../repositories/loyaltyRepository");

const POINTS_PER_RESTAURANT_RESERVATION = 10;
const POINTS_PER_EVENT_RESERVATION = 20;
const REWARD_THRESHOLD = 100;
const REWARD_CODE = "booking_10_off";

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

const getRewardStatus = async ({ userId, db }) => {
  const points = await loyaltyRepository.getUserPoints(userId, db);
  const reward = await loyaltyRepository.getRewardByCode({ userId, rewardCode: REWARD_CODE }, db);
  const unlocked = points >= REWARD_THRESHOLD;
  const redeemed = Boolean(reward);

  return {
    points,
    threshold: REWARD_THRESHOLD,
    rewardCode: REWARD_CODE,
    unlocked,
    redeemed,
  };
};

const redeemReward = async ({ userId, db }) => {
  const points = await loyaltyRepository.getUserPoints(userId, db);
  if (points < REWARD_THRESHOLD) {
    return { success: false, status: 409, error: "Not enough points to redeem reward." };
  }
  const existing = await loyaltyRepository.getRewardByCode({ userId, rewardCode: REWARD_CODE }, db);
  if (existing) {
    return { success: false, status: 409, error: "Reward already redeemed." };
  }
  const result = await loyaltyRepository.redeemReward(
    {
      userId,
      rewardCode: REWARD_CODE,
      pointsCost: REWARD_THRESHOLD,
    },
    db
  );
  if (!result.redeemed) {
    return { success: false, status: 409, error: "Reward could not be redeemed." };
  }
  return { success: true, status: 200, points: result.points };
};

module.exports = {
  POINTS_PER_RESTAURANT_RESERVATION,
  POINTS_PER_EVENT_RESERVATION,
  REWARD_THRESHOLD,
  REWARD_CODE,
  awardPointsForReservation,
  awardPointsForEvent,
  getRewardStatus,
  redeemReward,
};
