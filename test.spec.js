const { test, expect } = require("@playwright/test");

const version = process.env.CHEERPX_VERSION;
if (!version) throw new Error("CHEERPX_VERSION env required");

const n = process.env.N ?? "6";
const deadline = process.env.DEADLINE_MS ?? "3000";

test(`concurrent-tcp-hang ${version} N=${n}`, async ({ page }) => {
  page.on("console", (msg) =>
    console.log(`[browser ${msg.type()}] ${msg.text()}`),
  );

  await page.goto(
    `http://localhost:3000/?v=${version}&n=${n}&deadline=${deadline}`,
  );

  let outcome;
  try {
    const handle = await page.waitForFunction(
      () => {
        if (window.testError) return { kind: "error", error: window.testError };
        if (window.testComplete)
          return { kind: "complete", result: window.testResult };
        if (window.testWedged)
          return { kind: "wedged", result: window.testResult };
        return null;
      },
      null,
      { timeout: 10_000 },
    );
    outcome = await handle.jsonValue();
  } catch (e) {
    if (e.name === "TimeoutError") {
      outcome = { kind: "wedged", reason: "main itself stuck — no RESULT in 10s" };
    } else {
      throw e;
    }
  }
  console.log("outcome:", outcome);

  expect(outcome.kind).toBe("complete");
});
