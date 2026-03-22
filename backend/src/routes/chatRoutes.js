const express = require("express");
const router = express.Router();
const { parseDineSmartMessage } = require("../services/githubModelsService");
const searchService = require("../services/searchService");
const restaurantService = require("../services/restaurantService");
const reservationService = require("../services/reservationService");

console.log("chatRoutes.js loaded");

const normalizePriceRanges = (priceRanges = []) => {
  const normalized = new Set();

  for (const raw of priceRanges) {
    const value = String(raw || "").trim().toLowerCase();

    if (!value) continue;
    if (["$", "$$", "$$$", "$$$$"].includes(value)) {
      normalized.add(value);
      continue;
    }
    if (["cheap", "budget", "affordable", "inexpensive", "low"].includes(value)) {
      normalized.add("$");
      continue;
    }
    if (["moderate", "mid", "mid-range", "average"].includes(value)) {
      normalized.add("$$");
      continue;
    }
    if (["expensive", "fancy", "fine dining", "luxury", "high-end"].includes(value)) {
      normalized.add("$$$");
      continue;
    }
  }

  return [...normalized];
};

const getTodayDate = () => new Date().toISOString().slice(0, 10);

const getCurrentTime = () => {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}:00`;
};

const isOpenNow = (openingTime, closingTime) => {
  if (!openingTime || !closingTime) return null;

  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();

  const [openH, openM] = String(openingTime).split(":").map(Number);
  const [closeH, closeM] = String(closingTime).split(":").map(Number);

  const open = openH * 60 + openM;
  const close = closeH * 60 + closeM;

  if (open <= close) {
    return current >= open && current <= close;
  }

  return current >= open || current <= close;
};

const articleFor = (phrase = "") => {
  const text = String(phrase || "").trim();
  if (!text) return "a";

  const lower = text.toLowerCase();

  const specialAnPrefixes = ["honest", "honor", "honour", "hour", "heir", "herb"];
  const specialAStarts = ["uni", "use", "user", "utility", "utensil", "uk", "euro", "one", "once", "ubiquit", "ufo"];

  if (specialAnPrefixes.some((prefix) => lower.startsWith(prefix))) return "an";
  if (specialAStarts.some((prefix) => lower.startsWith(prefix))) return "a";
  if (/^[aeio]/.test(lower)) return "an";
  if (/^u/.test(lower)) return "an";

  return "a";
};

const formatCuisinePhrase = (cuisine = "") => {
  const cleaned = String(cuisine || "").trim();
  if (!cleaned) return "restaurant";
  return `${articleFor(cleaned)} ${cleaned} restaurant`;
};

const buildRestaurantCard = (restaurant) => ({
  id: restaurant.id,
  name: restaurant.name,
  cuisine: restaurant.cuisine,
  rating: restaurant.rating,
  price_range: restaurant.price_range,
  dietary_support: restaurant.dietary_support || [],
  opening_time: restaurant.opening_time,
  closing_time: restaurant.closing_time,
  address: restaurant.address,
  distance_km: restaurant.distance_km,
  review_count: restaurant.review_count,
  active_event_count: restaurant.active_event_count,
  popularity_score: restaurant.popularity_score
});

const buildSearchMessage = (parsed, restaurants) => {
  if (!restaurants.length) {
    return "I couldn’t find a strong match right now. Try changing the cuisine, budget, or dietary filter and I’ll search again.";
  }

  const top = restaurants.slice(0, 3);
  const first = top[0];
  const cuisineLabel = parsed.cuisines?.length ? parsed.cuisines.join(", ") : first.cuisine || "restaurant";

  if (top.length === 1) {
    return `I found a great option for you: ${first.name}, ${formatCuisinePhrase(cuisineLabel)}${first.rating ? ` rated ${first.rating}` : ""}${first.price_range ? ` in the ${first.price_range} price range` : ""}.`;
  }

  const names = top.map((r) => r.name).join(", ");
  return `Here are a few ${cuisineLabel} places you might enjoy: ${names}. I picked them based on your request and sorted the results by rating.`;
};

const buildSearchSuggestions = (parsed, restaurants) => {
  if (!restaurants.length) {
    return ["Try another cuisine", "Add a budget like $$", "Remove one filter", "Search open now"];
  }

  const suggestions = [];
  if (!parsed.priceRanges?.length) suggestions.push("Filter by budget");
  if (!parsed.dietarySupport?.length) suggestions.push("Add vegan, halal, or vegetarian");
  if (!parsed.openNow) suggestions.push("Show only places open now");
  suggestions.push("Sort by rating");

  return suggestions.slice(0, 4);
};

const buildPopularityText = (restaurant) => {
  const rating = Number(restaurant.rating || 0);
  const reviews = Number(restaurant.review_count || 0);

  if (rating >= 4.5 && reviews >= 50) {
    return `${restaurant.name} seems very well-loved — it has a strong ${rating.toFixed(1)} rating across ${reviews} reviews.`;
  }

  if (rating >= 4.0 && reviews >= 10) {
    return `${restaurant.name} seems to be well-liked by diners, with a ${rating.toFixed(1)} rating${reviews ? ` from ${reviews} reviews` : ""}.`;
  }

  if (rating > 0) {
    return `${restaurant.name} currently has a ${rating.toFixed(1)} rating${reviews ? ` from ${reviews} reviews` : ""}.`;
  }

  return `I found ${restaurant.name}, but I don’t have enough rating information yet to say how popular it is.`;
};

const buildRestaurantDetailsMessage = (userMessage, restaurant, parsed) => {
  const lowerMessage = String(userMessage || "").toLowerCase();
  const asksPopularity =
    /\b(loved|popular|good|great|worth|liked|best|famous|recommended|well[- ]?liked)\b/.test(lowerMessage);

  if (asksPopularity) {
    return buildPopularityText(restaurant);
  }

  const parts = [];

  parts.push(`${restaurant.name} is ${formatCuisinePhrase(restaurant.cuisine)}`);

  if (restaurant.rating) {
    parts.push(`with a ${Number(restaurant.rating).toFixed(1)} rating`);
  }

  if (restaurant.price_range) {
    parts.push(`in the ${restaurant.price_range} price range`);
  }

  if (restaurant.opening_time && restaurant.closing_time) {
    parts.push(`and it’s open from ${restaurant.opening_time} to ${restaurant.closing_time}`);
  }

  return `${parts.join(" ")}.`;
};

router.post("/chat", async (req, res) => {
  const startedAt = Date.now();
  console.log("1. CHAT ROUTE HIT");

  try {
    const { message } = req.body;
    console.log("2. message received:", message);

    if (!message || !message.trim()) {
      console.log("3. message missing");
      console.log("TOTAL ROUTE TIME ms:", Date.now() - startedAt);
      return res.status(400).json({ message: "Message is required" });
    }

    const normalizedMessage = String(message).trim().toLowerCase();

    if (["hi", "hii", "hiiii", "hello", "hey", "heyy"].includes(normalizedMessage)) {
      console.log("3. fast greeting path");
      console.log("TOTAL ROUTE TIME ms:", Date.now() - startedAt);
      return res.json({
        message: "Hi! I’m Diney — I can help you find restaurants, check opening hours, and look up seat availability.",
        parsed: {
          intent: "greeting",
          greeting: true,
          outOfScope: false,
          needsClarification: false,
          clarificationQuestion: "",
          restaurantName: "",
          cuisines: [],
          dietarySupport: [],
          priceRanges: [],
          vibe: [],
          openNow: false,
          minRating: null,
          partySize: null,
          availabilityDate: "",
          availabilityTime: "",
          summary: "Greeting"
        },
        restaurants: [],
        suggestions: [
          "Suggest Italian restaurants",
          "Show open places now",
          "Check availability at a restaurant",
          "Find 4-star places"
        ]
      });
    }

    console.log("4. before parseDineSmartMessage");
    const parseStartedAt = Date.now();
    const parsed = await parseDineSmartMessage(message);
    console.log("5. parsed finished:", parsed);
    console.log("PARSE TIME ms:", Date.now() - parseStartedAt);

    if (parsed.greeting) {
      console.log("6. greeting branch");
      console.log("TOTAL ROUTE TIME ms:", Date.now() - startedAt);
      return res.json({
        message: "Hi! I’m Diney — I can help you find restaurants, check opening hours, and look up seat availability.",
        parsed,
        restaurants: [],
        suggestions: [
          "Suggest Italian restaurants",
          "Show open places now",
          "Check availability at a restaurant",
          "Find 4-star places"
        ]
      });
    }

    if (parsed.outOfScope) {
      console.log("7. outOfScope branch");
      console.log("TOTAL ROUTE TIME ms:", Date.now() - startedAt);
      return res.json({
        message: "I can help with DineSmart restaurant searches, restaurant details, hours, availability, and restaurant-related website questions.",
        parsed,
        restaurants: [],
        suggestions: [
          "Suggest sushi places",
          "Is Victoria open now?",
          "Check availability tonight",
          "Find vegan restaurants"
        ]
      });
    }

    if (parsed.needsClarification) {
      console.log("8. clarification branch");

      // lightweight rescue: if user typed only a restaurant name, try matching it before asking clarification
      const maybeRestaurantName = String(message || "").trim();
      if (maybeRestaurantName && maybeRestaurantName.split(/\s+/).length <= 5) {
        const rescueLookupStartedAt = Date.now();
        const rescuedRestaurant = await restaurantService.findRestaurantByName(maybeRestaurantName);
        console.log("RESTAURANT LOOKUP TIME ms:", Date.now() - rescueLookupStartedAt);

        if (rescuedRestaurant) {
          console.log("8b. clarification rescued into restaurant_details");
          console.log("TOTAL ROUTE TIME ms:", Date.now() - startedAt);
          return res.json({
            message: buildRestaurantDetailsMessage(message, rescuedRestaurant, parsed),
            parsed: {
              ...parsed,
              intent: "restaurant_details",
              restaurantName: rescuedRestaurant.name,
              needsClarification: false,
              clarificationQuestion: ""
            },
            restaurant: buildRestaurantCard(rescuedRestaurant),
            suggestions: [
              "Check availability there",
              "Is it open now?",
              "Show similar restaurants",
              "See highly rated options"
            ]
          });
        }
      }

      console.log("TOTAL ROUTE TIME ms:", Date.now() - startedAt);
      return res.json({
        message: parsed.clarificationQuestion || "Could you tell me a bit more about what you’re looking for?",
        parsed,
        restaurants: [],
        suggestions: [
          "Italian restaurants",
          "Open now",
          "4-star places",
          "Availability tonight"
        ]
      });
    }

    if (parsed.intent === "hours_check" || parsed.intent === "restaurant_details") {
      console.log("9. hours/details branch");

      if (!parsed.restaurantName) {
        console.log("10. no restaurantName for hours/details");
        console.log("TOTAL ROUTE TIME ms:", Date.now() - startedAt);
        return res.json({
          message: "Which restaurant would you like me to check?",
          parsed,
          restaurants: [],
          suggestions: ["Victoria", "Sushi World", "Curry Palace"]
        });
      }

      const restaurantLookupStartedAt = Date.now();
      console.log("11. before findRestaurantByName:", parsed.restaurantName);
      const restaurant = await restaurantService.findRestaurantByName(parsed.restaurantName);
      console.log("12. after findRestaurantByName:", restaurant?.name || null);
      console.log("RESTAURANT LOOKUP TIME ms:", Date.now() - restaurantLookupStartedAt);

      if (!restaurant) {
        console.log("13. restaurant not found");
        console.log("TOTAL ROUTE TIME ms:", Date.now() - startedAt);
        return res.json({
          message: `I couldn’t find a restaurant named "${parsed.restaurantName}".`,
          parsed,
          restaurants: [],
          suggestions: ["Check the spelling", "Try another restaurant name"]
        });
      }

      const openStatus = isOpenNow(restaurant.opening_time, restaurant.closing_time);
      console.log("14. hours/details response ready");
      console.log("TOTAL ROUTE TIME ms:", Date.now() - startedAt);

      return res.json({
        message: parsed.intent === "hours_check"
          ? `${restaurant.name} is open from ${restaurant.opening_time || "N/A"} to ${restaurant.closing_time || "N/A"}${parsed.openNow ? `, and it is currently ${openStatus ? "open" : "closed"}` : ""}.`
          : buildRestaurantDetailsMessage(message, restaurant, parsed),
        parsed,
        restaurant: buildRestaurantCard(restaurant),
        suggestions: [
          "Check availability there",
          "Show similar restaurants",
          "Show open now",
          "See highly rated options"
        ]
      });
    }

    if (parsed.intent === "availability_check") {
      console.log("15. availability branch");

      if (!parsed.restaurantName) {
        console.log("16. no restaurantName for availability");
        console.log("TOTAL ROUTE TIME ms:", Date.now() - startedAt);
        return res.json({
          message: "Which restaurant would you like me to check availability for?",
          parsed,
          restaurants: [],
          suggestions: ["Victoria tonight for 2", "Sushi World at 8 PM", "Curry Palace tomorrow"]
        });
      }

      const restaurantLookupStartedAt = Date.now();
      console.log("17. before findRestaurantByName:", parsed.restaurantName);
      const restaurant = await restaurantService.findRestaurantByName(parsed.restaurantName);
      console.log("18. after findRestaurantByName:", restaurant?.name || null);
      console.log("RESTAURANT LOOKUP TIME ms:", Date.now() - restaurantLookupStartedAt);

      if (!restaurant) {
        console.log("19. restaurant not found for availability");
        console.log("TOTAL ROUTE TIME ms:", Date.now() - startedAt);
        return res.json({
          message: `I couldn’t find a restaurant named "${parsed.restaurantName}".`,
          parsed,
          restaurants: [],
          suggestions: ["Check the spelling", "Try another restaurant name"]
        });
      }

      const reservationDate = parsed.availabilityDate || getTodayDate();
      const reservationTime = parsed.availabilityTime || getCurrentTime();
      const partySize = parsed.partySize || 2;

      console.log("20. before getAvailability", {
        restaurantId: restaurant.id,
        reservationDate,
        reservationTime,
        partySize
      });

      const availabilityStartedAt = Date.now();
      const result = await reservationService.getAvailability({
        restaurantId: restaurant.id,
        reservationDate,
        reservationTime,
        partySize
      });
      console.log("21. after getAvailability", result);
      console.log("AVAILABILITY TIME ms:", Date.now() - availabilityStartedAt);

      if (!result.success) {
        console.log("22. availability returned failure");
        console.log("TOTAL ROUTE TIME ms:", Date.now() - startedAt);
        return res.status(result.status).json({
          message: result.error,
          parsed,
          restaurant: buildRestaurantCard(restaurant),
          suggestions: ["Try another time", "Reduce party size", "Check tomorrow instead"]
        });
      }

      console.log("23. availability response ready");
      console.log("TOTAL ROUTE TIME ms:", Date.now() - startedAt);

      return res.json({
        message: `${restaurant.name} currently has ${result.availability.available_seats} seats available at ${result.availability.reservation_time} on ${result.availability.reservation_date}. ${result.availability.can_accommodate_party ? `It can accommodate a party of ${partySize}.` : `It cannot accommodate a party of ${partySize} at that time.`}`,
        parsed,
        restaurant: buildRestaurantCard(restaurant),
        availability: result.availability,
        suggestions: result.availability.suggested_times?.length
          ? result.availability.suggested_times
          : ["Try a different time", "Try another date"]
      });
    }

    const filters = {
      priceRanges: normalizePriceRanges(parsed.priceRanges || []),
      dietarySupport: parsed.dietarySupport || [],
      minRating: parsed.minRating,
      openNow: parsed.openNow === true,
      availabilityDate: parsed.availabilityDate || null,
      availabilityTime: parsed.availabilityTime || null,
      sortBy: "rating",
      verifiedOnly: true
    };

    console.log("24. before searchService", {
      query: parsed.restaurantName || "",
      cuisines: parsed.cuisines || [],
      filters
    });

    const searchStartedAt = Date.now();
    const restaurants = await searchService.searchRestaurants({
      query: parsed.restaurantName || "",
      cuisines: parsed.cuisines || [],
      filters
    });
    console.log("25. after searchService", restaurants?.length);
    console.log("SEARCH TIME ms:", Date.now() - searchStartedAt);

    const cards = restaurants.slice(0, 5).map(buildRestaurantCard);
    console.log("26. final search response ready");
    console.log("TOTAL ROUTE TIME ms:", Date.now() - startedAt);

    return res.json({
      message: buildSearchMessage(parsed, cards),
      parsed,
      restaurants: cards,
      suggestions: buildSearchSuggestions(parsed, cards)
    });
  } catch (error) {
    console.error("27. Chat route error:", error);
    console.error("28. Error message:", error?.message);
    console.error("29. Error stack:", error?.stack);
    console.log("TOTAL ROUTE TIME ms:", Date.now() - startedAt);
    return res.status(500).json({
      message: "Something went wrong while processing your request."
    });
  }
});

module.exports = router;