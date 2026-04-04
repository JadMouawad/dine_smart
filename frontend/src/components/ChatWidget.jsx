import React, { useEffect, useRef, useState } from "react";
import { FiMessageCircle, FiSend, FiX, FiCheckCircle } from "react-icons/fi";

import { useAuth } from "../auth/AuthContext.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const TOOL_ICONS = {
  search_restaurants: "🔍",
  get_restaurant_details: "📋",
  check_availability: "📅",
  make_reservation: "✅",
  search_menu_items: "🍽️",
};

const TOOL_DISPLAY_NAMES = {
  search_restaurants: "Searching restaurants",
  get_restaurant_details: "Looking up restaurant",
  check_availability: "Checking availability",
  make_reservation: "Making reservation",
  search_menu_items: "Searching menus",
};

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
  reservation = null,
  timestamp = new Date().toISOString(),
  toolSteps = [],
  streaming = false,
}) => ({
  id,
  role,
  text,
  actions,
  restaurants,
  suggestions,
  reservation,
  timestamp,
  toolSteps,
  streaming,
});

const STARTER_MESSAGES = [
  createMessage({
    role: "assistant",
    text: "Hi, I'm Diney — your DineSmart assistant. Ask me to find restaurants, check hours, see if a place has seats, or book a table for you.",
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
    reservation: response?.reservation ?? null,
  });
}

// ─── Tool status bar ─────────────────────────────────────────────────────────

function ToolStatusBar({ toolSteps = [] }) {
  if (!toolSteps.length) return null;
  return (
    <div className="chatWidget__toolStatus">
      {toolSteps.map((step, i) => (
        <div
          key={`${step.tool}-${i}`}
          className={`chatWidget__toolStatus__item${step.done ? " chatWidget__toolStatus__item--done" : ""}`}
        >
          <span className="chatWidget__toolStatus__icon">
            {TOOL_ICONS[step.tool] || "⚙️"}
          </span>
          <span className="chatWidget__toolStatus__label">
            {TOOL_DISPLAY_NAMES[step.tool] || step.tool}
          </span>
          {step.done && step.summary && (
            <span className="chatWidget__toolStatus__summary">· {step.summary}</span>
          )}
          {!step.done && (
            <span className="chatWidget__toolStatus__spinner">…</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Reservation confirmation card ───────────────────────────────────────────

function ReservationCard({ reservation }) {
  if (!reservation?.success) return null;

  const r = reservation.reservation ?? {};
  const date = r.reservation_date
    ? new Date(r.reservation_date + "T00:00:00").toLocaleDateString([], {
        weekday: "short", year: "numeric", month: "short", day: "numeric",
      })
    : "—";
  const time = r.reservation_time
    ? r.reservation_time.slice(0, 5)
    : "—";

  return (
    <div className="chatWidget__reservationCard">
      <div className="chatWidget__reservationCard__header">
        <FiCheckCircle className="chatWidget__reservationCard__icon" />
        <span>Reservation Confirmed</span>
      </div>
      <div className="chatWidget__reservationCard__details">
        <div className="chatWidget__reservationCard__row">
          <span className="chatWidget__reservationCard__label">Restaurant</span>
          <span className="chatWidget__reservationCard__value">{reservation.restaurant_name || "—"}</span>
        </div>
        <div className="chatWidget__reservationCard__row">
          <span className="chatWidget__reservationCard__label">Date</span>
          <span className="chatWidget__reservationCard__value">{date}</span>
        </div>
        <div className="chatWidget__reservationCard__row">
          <span className="chatWidget__reservationCard__label">Time</span>
          <span className="chatWidget__reservationCard__value">{time}</span>
        </div>
        <div className="chatWidget__reservationCard__row">
          <span className="chatWidget__reservationCard__label">Guests</span>
          <span className="chatWidget__reservationCard__value">{r.party_size ?? "—"}</span>
        </div>
        {r.seating_preference && r.seating_preference !== "any" && (
          <div className="chatWidget__reservationCard__row">
            <span className="chatWidget__reservationCard__label">Seating</span>
            <span className="chatWidget__reservationCard__value">{r.seating_preference}</span>
          </div>
        )}
        {r.special_request && (
          <div className="chatWidget__reservationCard__row">
            <span className="chatWidget__reservationCard__label">Request</span>
            <span className="chatWidget__reservationCard__value">{r.special_request}</span>
          </div>
        )}
      </div>
      <div className="chatWidget__reservationCard__id">
        Confirmation ID: <strong>{reservation.confirmation_id}</strong>
      </div>
    </div>
  );
}

// ─── Main Widget ──────────────────────────────────────────────────────────────

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

  // Build conversation history to send as context
  const buildHistory = (currentMessages) =>
    currentMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.text }));

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const location =
      user?.latitude != null && user?.longitude != null
        ? { latitude: user.latitude, longitude: user.longitude }
        : null;

    setError("");
    setInput("");

    const updatedMessages = [...messages, createMessage({ role: "user", text: trimmed })];
    setMessages(updatedMessages);
    setLoading(true);

    // Create a placeholder assistant message that we'll update in place
    const streamingMsgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const streamingMsg = createMessage({
      id: streamingMsgId,
      role: "assistant",
      text: "",
      streaming: true,
      toolSteps: [],
    });

    // We'll show the typing indicator until the first event arrives, then switch to streaming msg
    let streamStarted = false;

    const addStreamingMsg = () => {
      if (!streamStarted) {
        streamStarted = true;
        setLoading(false);
        setMessages((prev) => [...prev, { ...streamingMsg }]);
      }
    };

    const updateStreamingMsg = (updater) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === streamingMsgId ? updater(m) : m))
      );
    };

    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token") || "";

      const history = buildHistory(updatedMessages);

      const response = await fetch(`${API_BASE}/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: trimmed,
          location,
          history,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error ${response.status}`);
      }

      addStreamingMsg();

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      const processLine = (line) => {
        const trimmedLine = line.trim();
        if (!trimmedLine.startsWith("data:")) return;
        const payload = trimmedLine.slice(5).trim();
        if (!payload) return;

        let evt;
        try {
          evt = JSON.parse(payload);
        } catch (_) {
          return;
        }

        if (evt.type === "tool_start") {
          updateStreamingMsg((m) => ({
            ...m,
            toolSteps: [
              ...m.toolSteps,
              { tool: evt.tool, done: false, summary: "" },
            ],
          }));
        } else if (evt.type === "tool_done") {
          updateStreamingMsg((m) => ({
            ...m,
            toolSteps: m.toolSteps.map((s) =>
              s.tool === evt.tool && !s.done
                ? { ...s, done: true, summary: evt.summary || "" }
                : s
            ),
          }));
        } else if (evt.type === "delta") {
          updateStreamingMsg((m) => ({
            ...m,
            text: m.text + (evt.text || ""),
          }));
        } else if (evt.type === "done") {
          updateStreamingMsg((m) => ({
            ...m,
            streaming: false,
            restaurants: Array.isArray(evt.restaurants) ? evt.restaurants : [],
            suggestions: Array.isArray(evt.suggestions) ? evt.suggestions : [],
            reservation: evt.reservation ?? null,
          }));
        } else if (evt.type === "error") {
          updateStreamingMsg((m) => ({
            ...m,
            streaming: false,
            text: evt.message || "I hit a temporary issue. Please try again.",
          }));
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          processLine(line);
        }
      }

      // Flush remaining buffer
      if (buffer.trim()) {
        processLine(buffer);
      }

      // Mark streaming done if not already
      updateStreamingMsg((m) => (m.streaming ? { ...m, streaming: false } : m));
    } catch (requestError) {
      if (!streamStarted) {
        setLoading(false);
      }
      setError(requestError.message || "Chat is temporarily unavailable.");
      if (streamStarted) {
        updateStreamingMsg((m) => ({
          ...m,
          streaming: false,
          text: m.text || "I hit a temporary issue. You can still browse and search restaurants directly.",
        }));
      } else {
        setMessages((prev) => [
          ...prev,
          createMessage({
            role: "assistant",
            text: "I hit a temporary issue. You can still browse and search restaurants directly.",
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
      }
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
              <p className="chatWidget__subtitle">Powered by GPT-4o · DineSmart AI</p>
            </div>
            <button
              type="button"
              className="chatWidget__iconBtn"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              <FiX />
            </button>
          </header>

          <div className="chatWidget__messages" ref={listRef}>
            {messages.map((message) => (
              <article
                key={message.id}
                className={`chatWidget__message chatWidget__message--${message.role}`}
              >
                {/* Tool status steps */}
                {message.role === "assistant" && message.toolSteps?.length > 0 && (
                  <ToolStatusBar toolSteps={message.toolSteps} />
                )}

                <div className="chatWidget__bubble">
                  {message.text ? (
                    <p className="chatWidget__text">{message.text}</p>
                  ) : message.streaming ? (
                    <div className="chatWidget__bubble chatWidget__bubble--typing">
                      <span className="chatWidget__typingDot" />
                      <span className="chatWidget__typingDot" />
                      <span className="chatWidget__typingDot" />
                    </div>
                  ) : null}
                </div>
                <div className="chatWidget__timestamp">{formatTimestamp(message.timestamp)}</div>

                {/* Reservation confirmation card */}
                {message.reservation?.success && (
                  <ReservationCard reservation={message.reservation} />
                )}

                {/* Action buttons */}
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

                {/* Restaurant cards */}
                {message.restaurants.length > 0 && (
                  <div className="chatWidget__cards">
                    {message.restaurants.map((restaurant) => (
                      <article
                        key={`${message.id}-${restaurant.id}`}
                        className="chatWidget__card"
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          handleAction({
                            type: "view_restaurant",
                            label: "View restaurant",
                            payload: { restaurantId: restaurant.id, restaurant },
                          })
                        }
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
                          <p className="chatWidget__cardCuisine">
                            {restaurant.cuisine || "Cuisine not listed"}
                          </p>
                          <p className="chatWidget__cardRating">
                            ⭐ {restaurant.rating ?? "N/A"}
                            {restaurant.price_range && ` · ${restaurant.price_range}`}
                            {restaurant.distance_km != null && ` · ${restaurant.distance_km} km`}
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
                                payload: {
                                  restaurantId: restaurant.id,
                                  restaurantName: restaurant.name,
                                  restaurant,
                                },
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

                {/* Suggestion chips (only when no action buttons) */}
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
                <div className="chatWidget__timestamp">
                  {formatTimestamp(new Date().toISOString())}
                </div>
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
                placeholder="Find Italian places, check hours, or book a table…"
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
