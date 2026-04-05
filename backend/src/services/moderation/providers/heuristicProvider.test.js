const assert = require("node:assert/strict");
const { FLAG_TYPES } = require("../constants");
const { classify } = require("./heuristicProvider");

const hasFlagType = (signals, flagType) => signals.some((signal) => signal.flagType === flagType);

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
