const crypto = require("crypto");
const loyaltyRepository = require("../repositories/loyaltyRepository");
const voucherRepository = require("../repositories/voucherRepository");

const DISCOUNT_PERCENTAGE = 10;
const POINTS_COST = 100;

const buildVoucherCode = () =>
  crypto.randomBytes(6).toString("hex").toUpperCase();

const addDays = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const redeemVoucher = async ({ userId, db }) => {
  const active = await voucherRepository.getActiveVoucherByUser({ userId }, db);
  if (active) {
    return { success: false, status: 409, error: "You already have an active voucher." };
  }
  const points = await loyaltyRepository.getUserPoints(userId, db);
  if (points < POINTS_COST) {
    return { success: false, status: 409, error: "Not enough points to redeem voucher." };
  }

  const uniqueCode = buildVoucherCode();
  const expirationDate = addDays(30);

  const voucher = await voucherRepository.createVoucher(
    { userId, discountPercentage: DISCOUNT_PERCENTAGE, uniqueCode, expirationDate },
    db
  );

  const deduction = await loyaltyRepository.deductPointsForReward({
    userId,
    sourceId: voucher.id,
    points: POINTS_COST,
  }, db);

  if (deduction.points == null) {
    return { success: false, status: 409, error: "Could not deduct points." };
  }

  return {
    success: true,
    status: 200,
    voucher,
  };
};

const validateAndUseVoucher = async ({ userId, code, db }) => {
  const voucher = await voucherRepository.getVoucherForUpdate({ userId, code }, db);
  if (!voucher) {
    return { success: false, status: 404, error: "Voucher not found." };
  }
  if (voucher.status !== "ACTIVE") {
    return { success: false, status: 409, error: "Voucher is not active." };
  }
  if (voucher.expiration_date < new Date().toISOString().slice(0, 10)) {
    return { success: false, status: 409, error: "Voucher has expired." };
  }
  const used = await voucherRepository.markVoucherUsed({ voucherId: voucher.id }, db);
  if (!used) {
    return { success: false, status: 409, error: "Voucher could not be used." };
  }
  return { success: true, voucher };
};

const getRewardStatus = async ({ userId, points }, db) => {
  const active = await voucherRepository.getActiveVoucherByUser({ userId }, db);
  return {
    points,
    threshold: POINTS_COST,
    rewardCode: "voucher_10_off",
    unlocked: points >= POINTS_COST,
    redeemed: Boolean(active),
    activeVoucher: active
      ? {
          id: active.id,
          code: active.unique_code,
          discountPercentage: active.discount_percentage,
          status: active.status,
          expirationDate: active.expiration_date,
          createdAt: active.created_at,
        }
      : null,
  };
};

module.exports = {
  DISCOUNT_PERCENTAGE,
  POINTS_COST,
  redeemVoucher,
  validateAndUseVoucher,
  getRewardStatus,
};
