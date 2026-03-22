const getTodayContext = () => {
  const now = new Date();

  return {
    isoDate: now.toISOString().slice(0, 10),
    year: now.getFullYear()
  };
};

const extractJson = (text = "") => {
  const trimmed = String(text || "").trim();

  try {
    return JSON.parse(trimmed);
  } catch (_) {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error(`Model did not return valid JSON. Raw output: ${trimmed}`);
    }
    return JSON.parse(match[0]);
  }
};

async function parseDineSmartMessage(message) {
  const today = getTodayContext();

  console.log("GM 1. parseDineSmartMessage called");
  console.log("GM 2. message:", message);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch("https://models.github.ai/inference/chat/completions", {
      method: "POST",
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: `
You are Diney, the DineSmart restaurant assistant.

Today's date is ${today.isoDate}. Current year is ${today.year}.

Only help with:
- restaurant search
- restaurant details
- hours
- availability
- DineSmart website help

Out-of-scope requests => outOfScope true.

Allowed intents:
- greeting
- restaurant_search
- restaurant_details
- hours_check
- availability_check

Use canonical cuisine labels.

Map dishes to cuisines:
- sushi, ramen => Japanese
- pizza, pasta => Italian
- shawarma, shawerma, batata, batata harra => Middle Eastern
- tacos, burritos => Mexican
- burgers => American

Important rules:
- If the message is only a restaurant name, or mostly a restaurant name, use intent "restaurant_details" and fill restaurantName.
- If the user asks whether a restaurant is good, loved by people, popular, worth trying, or highly rated, use intent "restaurant_details" and fill restaurantName.
- If the request is food-related but too vague, do not mark it out of scope immediately. Use needsClarification = true instead.
- When extracting restaurantName, do not include generic suffix words like "restaurant", "cafe", "café", "place", "bistro", or "grill" unless they are clearly part of the official name.

Return ONLY JSON:
{
  "intent": "",
  "greeting": false,
  "outOfScope": false,
  "needsClarification": false,
  "clarificationQuestion": "",
  "restaurantName": "",
  "cuisines": [],
  "dietarySupport": [],
  "priceRanges": [],
  "vibe": [],
  "openNow": false,
  "minRating": null,
  "partySize": null,
  "availabilityDate": "",
  "availabilityTime": "",
  "summary": ""
}
            `
          },
          {
            role: "user",
            content: message
          }
        ]
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    console.log("GM 3. HTTP status:", response.status);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`GitHub Models error ${response.status}: ${JSON.stringify(data)}`);
    }

    const text = data?.choices?.[0]?.message?.content || "";
    console.log("GM 4. model text:", text);

    return extractJson(text);
  } catch (error) {
    clearTimeout(timeout);

    if (error.name === "AbortError") {
      throw new Error("GitHub Models request timed out after 10 seconds.");
    }

    throw error;
  }
}

module.exports = { parseDineSmartMessage };