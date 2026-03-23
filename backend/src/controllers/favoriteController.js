const favoriteRepository = require("../repositories/favoriteRepository");

const getFavorites = async (req, res) => {
  try {
    const favorites = await favoriteRepository.getFavoritesByUserId(req.user.id);
    // Normalise column names to camelCase for the frontend
    const normalised = favorites.map((r) => ({
      id: r.id,
      name: r.name,
      cuisine: r.cuisine,
      price_range: r.price_range,
      rating: r.rating != null ? Number(r.rating) : null,
      coverUrl: r.cover_url || null,
      cover_url: r.cover_url || null,
      logoUrl: r.logo_url || null,
      logo_url: r.logo_url || null,
      address: r.address || null,
    }));
    res.json(normalised);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const addFavorite = async (req, res) => {
  try {
    const restaurantId = Number(req.body.restaurantId);
    if (!Number.isFinite(restaurantId) || restaurantId <= 0) {
      return res.status(400).json({ message: "Invalid restaurantId" });
    }
    await favoriteRepository.addFavorite(req.user.id, restaurantId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const removeFavorite = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId);
    if (!Number.isFinite(restaurantId) || restaurantId <= 0) {
      return res.status(400).json({ message: "Invalid restaurantId" });
    }
    await favoriteRepository.removeFavorite(req.user.id, restaurantId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getFavorites, addFavorite, removeFavorite };
