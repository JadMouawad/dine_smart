const chatService = require("../services/chatService");

const postChatMessage = async (req, res) => {
  try {
    const message = String(req.body.message || "").trim();
    const filters =
      req.body.filters && typeof req.body.filters === "object" ? req.body.filters : {};

    // Location forwarded from the browser (optional)
    const location =
      req.body.location &&
      typeof req.body.location === "object" &&
      req.body.location.latitude != null &&
      req.body.location.longitude != null
        ? {
            latitude: parseFloat(req.body.location.latitude),
            longitude: parseFloat(req.body.location.longitude),
          }
        : null;

    // Recent conversation history for context continuity (optional, max 20 turns)
    const history = Array.isArray(req.body.history)
      ? req.body.history.slice(-20).map((h) => ({
          role: String(h.role || "user"),
          content: String(h.content || ""),
        }))
      : [];

    const response = await chatService.getChatResponse({
      userId: req.user.id,
      message,
      filters,
      location,
      history,
    });

    return res.status(200).json(response);
  } catch (error) {
    return res.status(200).json({
      message:
        "Sorry, something went wrong while processing your request. Please try again in a moment.",
      restaurants: [],
      suggestions: ["Try again", "Change the filters", "Search with a simpler request"],
      requires_clarification: false,
      intent: "fallback",
      metadata: {
        model_provider: "local-rules-engine",
        model_name: "dinesmart-assistant-mvp-v1",
      },
    });
  }
};

module.exports = { postChatMessage };
