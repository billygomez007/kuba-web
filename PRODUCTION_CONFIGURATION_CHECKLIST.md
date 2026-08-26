# SuperKuba Production Configuration Checklist

Do not record secret values in this file.

| Category | Status | Owner verification |
| --- | --- | --- |
| Turso production URL/token | Needs Owner Verification | Confirm it is not `superkuba-staging` and never `kuba-staging` by mistake. |
| Better Auth secret and production URL | Needs Owner Verification | Confirm `https://superkuba.com` and secure cookies. |
| Preview/staging database separation | Needs Owner Verification | Confirm `superkuba-staging` only for staging. |
| OpenAI/AI provider | Needs Owner Verification | Confirm model access, quotas, and spend limits. |
| Resend/email sender and reply-to | Needs Owner Verification | Confirm DNS, sender identity, and environment-safe links. |
| Stripe/Paystack platform billing | Needs Owner Verification | Confirm test/live mode, webhook signing, and plan mapping. |
| WhatsApp/Twilio provider configuration | Needs Owner Verification | Confirm sandbox/test mode and callback URLs. |
| `AUTOMATION_PROCESS_SECRET` and voice secrets | Needs Owner Verification | Confirm configured and rotated without logging. |
| Encryption key | Needs Owner Verification | Confirm production key exists and fallback is impossible. |
| Error monitoring | Missing | Configure Sentry or equivalent with secret/PII filtering. |
| Durable rate limiting | Missing | Provide distributed protection for public and expensive routes. |
| Analytics/privacy configuration | Needs Owner Verification | Confirm consent, event minimization, and no message/document content. |
| Domain/DNS/TLS | Needs Owner Verification | Confirm production and staging domains are distinct. |
| Backup/restore evidence | Missing | Obtain provider backup policy and perform an approved restore drill. |
