const discoverService = require("../services/discoverService");

const getDiscoverFeed = async (req, res) => {
  try {
    const payload = await discoverService.getDiscoverFeed({
      userId: req.user.id,
      query: req.query,
    });
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getDiscoverFeed,
};
