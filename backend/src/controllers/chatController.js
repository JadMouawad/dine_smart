const chatService = require("../services/chatService");

const postChatMessage = async (req, res) => {
  try {
    const message = String(req.body.message || "").trim();
    const filters = req.body.filters && typeof req.body.filters === "object" ? req.body.filters : {};

    const response = await chatService.getChatResponse({
      userId: req.user.id,
      message,
      filters,
    });

    return res.status(200).json(response);
  } catch (error) {
    return res.status(200).json({
      message: "Sorry, something went wrong while processing the chat request. Please try again in a moment.",
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

module.exports = {
  postChatMessage,
};
