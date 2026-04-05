const restaurantRepository = require("../repositories/restaurantRepository");
const restaurantUpdateRepository = require("../repositories/restaurantUpdateRepository");
const subscriptionService = require("./subscriptionService");

const parsePositiveInt = (value) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return parsed;
};

const getOwnerUpdates = async ({ ownerId }) => {
  const updates = await restaurantUpdateRepository.getOwnerUpdates({ ownerId });
  return { success: true, status: 200, data: updates };
};

const createOwnerUpdate = async ({ ownerId, payload }) => {
  const updateType = String(payload.update_type || payload.updateType || "").trim().toLowerCase();
  if (!["news", "offers"].includes(updateType)) {
    return { success: false, status: 400, error: "update_type must be news or offers" };
  }
  const title = String(payload.title || "").trim();
  const message = String(payload.message || "").trim();
  if (!title) return { success: false, status: 400, error: "title is required" };
  if (title.length > 200) return { success: false, status: 400, error: "title must be at most 200 characters" };
  if (!message) return { success: false, status: 400, error: "message is required" };

  const restaurant = await restaurantRepository.getRestaurantByOwnerId(parsePositiveInt(ownerId));
  if (!restaurant) return { success: false, status: 404, error: "Restaurant not found" };
  if (!restaurant.is_verified || restaurant.approval_status !== "approved") {
    return { success: false, status: 409, error: "Only approved restaurants can post updates" };
  }

  const created = await restaurantUpdateRepository.createOwnerUpdate({
    restaurantId: restaurant.id,
    updateType,
    title,
    message,
  });

  const subject = `${restaurant.name} - ${title}`;
  const body = `${message}\n\nRestaurant: ${restaurant.name}`;
  await subscriptionService.sendSubscriptionUpdate({
    updateType,
    subject,
    message: body,
  });

  return { success: true, status: 201, data: created };
};

module.exports = {
  getOwnerUpdates,
  createOwnerUpdate,
};
