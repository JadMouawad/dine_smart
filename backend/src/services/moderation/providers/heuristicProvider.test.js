const assert = require("node:assert/strict");
const { FLAG_TYPES } = require("../constants");
const { mergeThresholds, suggestAction } = require("../policyEngine");
const { classify } = require("./heuristicProvider");

const hasFlagType = (signals, flagType) => signals.some((signal) => signal.flagType === flagType);
const getSignal = (signals, flagType) => signals.find((signal) => signal.flagType === flagType);
const requiresReview = (signal) =>
  suggestAction({
    flagType: signal.flagType,
    confidence: signal.confidence,
    thresholds: mergeThresholds(),
  }) === "REQUIRES_REVIEW";

const testCases = [
  {
    name: "detects explicit profanity",
    run: () => {
      const signals = classify({ text: "This place is f*cking trash.", rating: 1 });
      assert.equal(hasFlagType(signals, FLAG_TYPES.PROFANITY), true);
    },
  },
  {
    name: "detects harassment and threats",
    run: () => {
      const signals = classify({
        text: "The owner is useless and I will hurt your staff if this happens again.",
        rating: 1,
      });
      assert.equal(hasFlagType(signals, FLAG_TYPES.HARASSMENT), true);
    },
  },
  {
    name: "detects spam links and promotions",
    run: () => {
      const signals = classify({
        text: "Great offer! Visit www.fakepromo.com and subscribe now for coupons.",
        rating: 5,
      });
      assert.equal(hasFlagType(signals, FLAG_TYPES.SPAM), true);
    },
  },
  {
    name: "detects off-topic review content",
    run: () => {
      const signals = classify({
        text: "Join my crypto trading channel on telegram for guaranteed forex returns.",
        rating: 5,
      });
      assert.equal(hasFlagType(signals, FLAG_TYPES.INAPPROPRIATE_CONTENT), true);
    },
  },
  {
    name: "detects suspicious fake-review style patterns",
    run: () => {
      const signals = classify({
        text: "Worst ever scam fake reviews.",
        rating: 1,
      });
      assert.equal(hasFlagType(signals, FLAG_TYPES.FAKE_REVIEW), true);
    },
  },
  {
    name: "allows short friendly reviews",
    run: () => {
      const signals = classify({ text: "recommended!!", rating: 5 });
      assert.equal(signals.length, 0);
    },
  },
  {
    name: "requires review for obfuscated profanity",
    run: () => {
      const signals = classify({ text: "underrated, but fu!ck sh!t", rating: 5 });
      const profanitySignal = getSignal(signals, FLAG_TYPES.PROFANITY);
      assert.ok(profanitySignal);
      assert.equal(requiresReview(profanitySignal), true);
    },
  },
  {
    name: "requires review for direct personal insults",
    run: () => {
      const signals = classify({ text: "The waiter is an idiot", rating: 1 });
      const harassmentSignal = getSignal(signals, FLAG_TYPES.HARASSMENT);
      assert.ok(harassmentSignal);
      assert.equal(requiresReview(harassmentSignal), true);
    },
  },
  {
    name: "allows harsh food criticism when it is not a personal attack",
    run: () => {
      const signals = classify({ text: "The food was trash", rating: 1 });
      assert.equal(hasFlagType(signals, FLAG_TYPES.HARASSMENT), false);
    },
  },
];

let failed = false;
for (const testCase of testCases) {
  try {
    testCase.run();
    // eslint-disable-next-line no-console
    console.log(`PASS: ${testCase.name}`);
  } catch (error) {
    failed = true;
    // eslint-disable-next-line no-console
    console.error(`FAIL: ${testCase.name}`);
    // eslint-disable-next-line no-console
    console.error(error);
  }
}

if (failed) {
  process.exitCode = 1;
}
