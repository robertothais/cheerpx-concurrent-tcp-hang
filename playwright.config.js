module.exports = {
  testDir: ".",
  testMatch: /.*\.spec\.js/,
  timeout: 30_000,
  use: {
    headless: true,
  },
  reporter: "line",
};
