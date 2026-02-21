/**
 * Blocks access when authenticated user ID does not match requested profile ID.
 * Use for routes like GET /profile/:id or PUT /profile/:id when you need to
 * prevent users from accessing or modifying another user's profile.
 */

const blockAccessIfNotOwner = (req, res, next) => {
  const authenticatedUserId = req.user?.id;
  const requestedProfileId = parseInt(req.params.id ?? req.params.profileId, 10);

  if (!authenticatedUserId || isNaN(requestedProfileId)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  if (authenticatedUserId !== requestedProfileId) {
    return res.status(403).json({ message: "Forbidden: You cannot access another user's profile" });
  }

  next();
};

module.exports = { blockAccessIfNotOwner };
