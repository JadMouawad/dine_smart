import React, { useEffect, useRef, useState } from "react";
import { FiMessageCircle, FiSend, FiX } from "react-icons/fi";

import { useAuth } from "../auth/AuthContext.jsx";
import { sendChatMessage } from "../services/chatService.js";

const DEFAULT_CHAT_FILTERS = Object.freeze({
  minRating: 0,
  priceRange: [],
  dietarySupport: [],
  openNow: false,
  verifiedOnly: true,
  availabilityDate: "",
  availabilityTime: "",
  distanceEnabled: false,
  distanceRadius: 25,
  cuisines: [],
  sortBy: "rating",
});

const createMessage = ({
  id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  text,
  actions = [],
  restaurants = [],
  suggestions = [],
  timestamp = new Date().toISOString(),
}) => ({
  id,
  role,
  text,
  actions,
  restaurants,
  suggestions,
  timestamp,
});

const STARTER_MESSAGES = [
  createMessage({
    role: "assistant",
    text: "Hi, I'm Diney. Ask me about restaurants, hours, availability, or booking help.",
    actions: [
      {
        id: "starter-search",
        type: "search_restaurants",
        label: "Search restaurants",
        payload: { query: "", filters: DEFAULT_CHAT_FILTERS },
      },
      {
        id: "starter-open-now",
        type: "apply_filters",
        label: "Show open now",
        payload: { query: "", filters: { ...DEFAULT_CHAT_FILTERS, openNow: true } },
      },
    ],
  }),
];

function formatTimestamp(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function buildAssistantMessage(response) {
  const restaurants = Array.isArray(response?.restaurants)
    ? response.restaurants
    : response?.restaurant
      ? [response.restaurant]
      : [];

  return createMessage({
    role: "assistant",
    text: response?.message || "I couldn't prepare a response just now.",
    actions: Array.isArray(response?.actions) ? response.actions : [],
    restaurants,
    suggestions: Array.isArray(response?.suggestions) ? response.suggestions : [],
  });
}

export default function ChatWidget({ onAction }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(STARTER_MESSAGES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, loading, open]);

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const location = user?.latitude != null && user?.longitude != null
      ? { latitude: user.latitude, longitude: user.longitude }
      : null;

    setError("");
    setInput("");
    setMessages((prev) => [...prev, createMessage({ role: "user", text: trimmed })]);
    setLoading(true);

    try {
      const response = await sendChatMessage(trimmed, { location });
      setMessages((prev) => [...prev, buildAssistantMessage(response)]);
    } catch (requestError) {
      setError(requestError.message || "Chat is temporarily unavailable.");
      setMessages((prev) => [
        ...prev,
        createMessage({
          role: "assistant",
          text: "I hit a temporary issue, but you can still search restaurants or apply filters directly.",
          actions: [
            {
              id: "fallback-search",
              type: "search_restaurants",
              label: "Search restaurants",
              payload: { query: "", filters: DEFAULT_CHAT_FILTERS },
            },
          ],
        }),
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleAction(action) {
    onAction?.(action);
  }

  function handleSuggestionClick(suggestion) {
    setInput(suggestion);
  }

  return (
    <div className={`chatWidget ${open ? "is-open" : ""}`}>
      {open && (
        <section className="chatWidget__panel" aria-label="AI chat">
          <header className="chatWidget__header">
            <div>
              <h2 className="chatWidget__title">Diney</h2>
              <p className="chatWidget__subtitle">Restaurant help inside DineSmart</p>
            </div>
            
          </header>

          <div className="chatWidget__messages" ref={listRef}>
            {messages.map((message) => (
              <article
                key={message.id}
                className={`chatWidget__message chatWidget__message--${message.role}`}
              >
                <div className="chatWidget__bubble">
                  <p className="chatWidget__text">{message.text}</p>
                </div>
                <div className="chatWidget__timestamp">{formatTimestamp(message.timestamp)}</div>

                {message.actions.length > 0 && (
                  <div className="chatWidget__actions">
                    {message.actions.map((action) => (
                      <button
                        key={action.id || `${message.id}-${action.label}`}
                        type="button"
                        className="chatWidget__actionBtn"
                        onClick={() => handleAction(action)}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}

                {message.restaurants.length > 0 && (
                  <div className="chatWidget__cards">
                    {message.restaurants.map((restaurant) => (
                      <article
                        key={`${message.id}-${restaurant.id}`}
                        className="chatWidget__card"
                        role="button"
                        tabIndex={0}
                        onClick={() => handleAction({
                          type: "view_restaurant",
                          label: "View restaurant",
                          payload: { restaurantId: restaurant.id, restaurant },
                        })}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleAction({
                              type: "view_restaurant",
                              label: "View restaurant",
                              payload: { restaurantId: restaurant.id, restaurant },
                            });
                          }
                        }}
                      >
                        <div className="chatWidget__cardMeta">
                          <h3 className="chatWidget__cardName">{restaurant.name}</h3>
                          <p className="chatWidget__cardCuisine">{restaurant.cuisine || "Cuisine not listed"}</p>
                          <p className="chatWidget__cardRating">
                            Rating: {restaurant.rating ?? "N/A"}
                          </p>
                        </div>
                        <div className="chatWidget__cardActions">
                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleAction({
                                type: "view_restaurant",
                                label: "View restaurant",
                                payload: { restaurantId: restaurant.id, restaurant },
                              });
                            }}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="btn btn--gold"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleAction({
                                type: "book_table",
                                label: "Book a table",
                                payload: { restaurantId: restaurant.id, restaurantName: restaurant.name, restaurant },
                              });
                            }}
                          >
                            Book
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}

                {message.actions.length === 0 && message.suggestions.length > 0 && (
                  <div className="chatWidget__suggestions">
                    {message.suggestions.map((suggestion) => (
                      <button
                        key={`${message.id}-${suggestion}`}
                        type="button"
                        className="chatWidget__suggestionBtn"
                        onClick={() => handleSuggestionClick(suggestion)}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </article>
            ))}

            {loading && (
              <article className="chatWidget__message chatWidget__message--assistant">
                <div className="chatWidget__bubble chatWidget__bubble--typing">
                  <span className="chatWidget__typingDot" />
                  <span className="chatWidget__typingDot" />
                  <span className="chatWidget__typingDot" />
                </div>
                <div className="chatWidget__timestamp">{formatTimestamp(new Date().toISOString())}</div>
              </article>
            )}
          </div>

          <form className="chatWidget__composer" onSubmit={handleSubmit}>
            <label className="chatWidget__composerLabel" htmlFor="chat-widget-input">
              Ask Diney anything
            </label>
            <div className="chatWidget__composerRow">
              <input
                id="chat-widget-input"
                className="chatWidget__input"
                type="text"
                placeholder="Find me Italian places, check hours, or ask for booking help"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                disabled={loading}
              />
              <button
                type="submit"
                className="chatWidget__sendBtn"
                disabled={loading || !input.trim()}
                aria-label="Send message"
              >
                <FiSend />
              </button>
            </div>
            {error && <p className="chatWidget__error">{error}</p>}
          </form>
        </section>
      )}

      <button
        type="button"
        className="chatWidget__toggle"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={open ? "Close AI chat" : "Open AI chat"}
      >
        {open ? <FiX /> : <FiMessageCircle />}
        <span>{open ? "Close Chat" : "Ask Diney"}</span>
      </button>
    </div>
  );
}
