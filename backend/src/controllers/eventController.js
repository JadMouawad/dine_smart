const eventService = require("../services/eventService");

const createOwnerEvent = async (req, res) => {
  try {
    const result = await eventService.createOwnerEvent({
      ownerId: req.user.id,
      payload: req.body,
    });
    if (!result.success) return res.status(result.status).json({ message: result.error });
    return res.status(result.status).json(result.data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getOwnerEvents = async (req, res) => {
  try {
    const result = await eventService.getOwnerEvents({ ownerId: req.user.id });
    return res.status(result.status).json(result.data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateOwnerEvent = async (req, res) => {
  try {
    const result = await eventService.updateOwnerEvent({
      ownerId: req.user.id,
      eventId: req.params.id,
      payload: req.body,
    });
    if (!result.success) return res.status(result.status).json({ message: result.error });
    return res.status(result.status).json(result.data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const deleteOwnerEvent = async (req, res) => {
  try {
    const result = await eventService.deleteOwnerEvent({
      ownerId: req.user.id,
      eventId: req.params.id,
    });
    if (!result.success) return res.status(result.status).json({ message: result.error });
    return res.status(result.status).json(result.data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getPublicEvents = async (req, res) => {
  try {
    const result = await eventService.getPublicEvents(req.query);
    return res.status(result.status).json(result.data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getRestaurantPublicEvents = async (req, res) => {
  try {
    const result = await eventService.getRestaurantPublicEvents(req.params.id);
    if (!result.success) return res.status(result.status).json({ message: result.error });
    return res.status(result.status).json(result.data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createOwnerEvent,
  getOwnerEvents,
  updateOwnerEvent,
  deleteOwnerEvent,
  getPublicEvents,
  getRestaurantPublicEvents,
};
