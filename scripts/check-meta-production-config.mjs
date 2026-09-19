const required = [
  "META_APP_ID",
  "META_APP_SECRET",
  "META_OAUTH_REDIRECT_URI",
  "META_WEBHOOK_VERIFY_TOKEN",
  "ENCRYPTION_KEY",
];

let missing = false;

console.log(
  "=== META PRODUCTION CONFIG CHECK ===",
);

for (const key of required) {
  const value =
    process.env[key];

  if (!value) {
    console.log(
      `MISSING  ${key}`,
    );

    missing = true;
  } else {
    console.log(
      `PRESENT  ${key}`,
    );
  }
}

if (missing) {
  process.exitCode = 2;
}
