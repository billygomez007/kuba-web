import crypto from "node:crypto";
import type { PlanId } from "./entitlements";

export type BillingStatus = "trialing" | "active" | "past_due" | "canceled" | "incomplete" | "paused" | "expired" | "enterprise_contract";
export type BillingSubscription = { provider?: "stripe" | "paystack"; providerCustomerId: string | null; providerSubscriptionId: string | null; providerEventId: string; plan: PlanId; status: BillingStatus; currentPeriodStart: Date | null; currentPeriodEnd: Date | null; cancelAtPeriodEnd: boolean; trialEnd: Date | null };
export type BillingCapabilities = {
  supportsHostedCheckout: boolean; supportsSubscriptions: boolean; supportsBillingPortal: boolean; supportsPlanChange: boolean;
  supportsCancellation: boolean; supportsResume: boolean; supportsRecurringAuthorization: boolean; supportsTrials: boolean;
  /** True for providers that need the authorize-card -> verify -> create-subscription(start_date) sequence (Paystack, and later Flutterwave) rather than one hosted checkout call that natively understands a trial (Stripe). */
  supportsMultiStepAuthorization: boolean;
};

/** Safe references returned after a card is authorized/tokenized — never raw card credentials. */
export type PaymentAuthorization = {
  authorizationCode: string; customerCode: string;
  cardBrand: string | null; last4: string | null; expMonth: string | null; expYear: string | null; bank: string | null;
  reference: string; verificationAmount: number; verificationCurrency: string; verificationRefunded: boolean;
};

export type BillingProvider = {
  name: "stripe" | "paystack";
  capabilities: BillingCapabilities;
  createCheckoutSession: (input: { customerId?: string | null; priceId: string; successUrl: string; cancelUrl: string; metadata: Record<string, string>; trialPeriodDays?: number; idempotencyKey?: string }) => Promise<{ id: string; url: string | null; customerId: string | null }>;
  createPortalSession: (customerId: string, returnUrl: string) => Promise<{ url: string }>;
  verifyTransaction?: (reference: string, expected: { email: string; businessId: string; plan: PlanId; amount: string; currency: string }) => Promise<BillingSubscription>;
  cancelSubscription?: (subscriptionId: string, customerReference?: string | null) => Promise<{ confirmed: boolean }>;
  changePlan?: (subscriptionId: string, planCode: string) => Promise<{ confirmed: boolean }>;
  parseWebhook: (payload: string, signature: string | null) => BillingSubscription | null;

  // --- Multi-step authorize-then-subscribe lifecycle (Paystack today; the
  // same shape a future Flutterwave provider would implement) ---
  /** Step 1: redirect the customer to the provider's hosted page to add/authorize a card. Charges a small, disclosed verification amount — Paystack does not support a true $0 authorization ("zero debits are not supported yet" per their own docs). */
  authorizePaymentMethod?: (input: { email: string; businessId: string; plan: PlanId; callbackUrl: string; currency: string }) => Promise<{ authorizationUrl: string; reference: string; verificationAmount: number; currency: string }>;
  /** Step 2: after the redirect back, verify the charge succeeded and extract safe, reusable references. Does NOT refund — call refundVerificationCharge separately so the caller controls ordering/error handling. */
  verifyPaymentMethod?: (reference: string) => Promise<PaymentAuthorization>;
  /** Refunds the small verification charge so the net cost to the customer is zero. */
  refundVerificationCharge?: (reference: string) => Promise<{ refunded: boolean }>;
  /** Step 3: creates the real subscription with a future start_date (trial end) — the provider itself attempts the first charge on that date, no SuperKuba-side timer required for the happy path. */
  createTrialSubscription?: (input: { customerCode: string; authorizationCode: string; planCode: string; startDate: Date }) => Promise<{ subscriptionCode: string; status: string }>;
};

export const TRIAL_DAYS = 14;

const stripePlanEnv = { starter: "STRIPE_PRICE_STARTER", growth: "STRIPE_PRICE_GROWTH", pro: "STRIPE_PRICE_PRO" } as const;
const paystackPlanEnv = { starter: "PAYSTACK_PLAN_STARTER", growth: "PAYSTACK_PLAN_GROWTH", pro: "PAYSTACK_PLAN_PRO" } as const;

// Paystack requires a real, non-zero initial charge to obtain a reusable card
// authorization ("we strongly suggest... an initial of about NGN 50 charge
// since zero debits are not supported yet" — Paystack's own recurring-charges
// documentation). This charge is refunded immediately after verification; it
// is card-authorization proof, never the subscription payment. Amounts are in
// the smallest currency unit (kobo/pesewas/cents).
const PAYSTACK_VERIFICATION_AMOUNT: Record<string, number> = { GHS: 100, NGN: 5000, ZAR: 500, USD: 100 };

/** Primary SuperKuba billing provider is Paystack. Stripe remains supported as an optional/internal provider — never required for normal trial onboarding. */
export function activeBillingProvider() { const provider = process.env.BILLING_PROVIDER || "paystack"; if (provider !== "stripe" && provider !== "paystack") throw new Error("Unsupported BILLING_PROVIDER configuration."); return provider as "stripe" | "paystack"; }
export function getConfiguredPriceId(plan: PlanId) { if (plan === "enterprise") return null; const provider = activeBillingProvider(); return process.env[(provider === "stripe" ? stripePlanEnv : paystackPlanEnv)[plan]] || null; }
export function paystackVerificationAmount(currency: string) { return PAYSTACK_VERIFICATION_AMOUNT[currency.toUpperCase()] ?? null; }

function stripeRequest(path: string, options: RequestInit) { const secret = process.env.STRIPE_SECRET_KEY; if (!secret) throw new Error("STRIPE_SECRET_KEY is not configured."); return fetch(`https://api.stripe.com/v1/${path}`, { ...options, headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded", ...options.headers } }); }
export const stripeProvider: BillingProvider = {
  name: "stripe", capabilities: { supportsHostedCheckout: true, supportsSubscriptions: true, supportsBillingPortal: true, supportsPlanChange: true, supportsCancellation: true, supportsResume: true, supportsRecurringAuthorization: true, supportsTrials: true, supportsMultiStepAuthorization: false },
  async createCheckoutSession(input) { const form = new URLSearchParams({ mode: "subscription", "line_items[0][price]": input.priceId, "line_items[0][quantity]": "1", success_url: input.successUrl, cancel_url: input.cancelUrl, "metadata[businessId]": input.metadata.businessId, "metadata[plan]": input.metadata.plan }); if (input.customerId) form.set("customer", input.customerId); if (input.trialPeriodDays) form.set("subscription_data[trial_period_days]", String(input.trialPeriodDays)); const response = await stripeRequest("checkout/sessions", { method: "POST", body: form, headers: input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : undefined }); const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || "Stripe checkout could not be created."); return { id: data.id, url: data.url, customerId: data.customer || null }; },
  // Cancels at the end of the current period/trial (never an immediate cut-off) so a
  // trial customer who cancels keeps their already-promised access and is never
  // charged, and a paying customer keeps access through what they already paid for.
  async cancelSubscription(subscriptionId) { const response = await stripeRequest(`subscriptions/${encodeURIComponent(subscriptionId)}`, { method: "POST", body: new URLSearchParams({ cancel_at_period_end: "true" }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || "Stripe subscription cancellation failed."); return { confirmed: true }; },
  async createPortalSession(customerId, returnUrl) { const response = await stripeRequest("billing_portal/sessions", { method: "POST", body: new URLSearchParams({ customer: customerId, return_url: returnUrl }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || "Billing portal could not be opened."); return { url: data.url }; },
  parseWebhook(payload, signature) { const secret = process.env.STRIPE_WEBHOOK_SECRET; if (!secret || !signature) return null; const timestamp = signature.split(",").find((item) => item.startsWith("t="))?.slice(2); const hash = signature.split(",").find((item) => item.startsWith("v1="))?.slice(3); if (!timestamp || !hash) return null; const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex"); if (expected.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hash))) return null; const event = JSON.parse(payload) as { id: string; type: string; data: { object: Record<string, unknown> } }; const object = event.data.object; const statusMap: Record<string, BillingStatus> = { active: "active", trialing: "trialing", past_due: "past_due", canceled: "canceled", incomplete: "incomplete", paused: "paused", unpaid: "expired" }; const eventStatus: Partial<Record<string, BillingStatus>> = { "checkout.session.completed": "active", "invoice.payment_succeeded": "active", "invoice.payment_failed": "past_due", "customer.subscription.trial_will_end": "trialing" }; const status = statusMap[String(object.status || "")] || eventStatus[event.type] || (event.type.includes("deleted") ? "canceled" : null); if (!status) return null; const metadata = (object.metadata || {}) as Record<string, string>; const price = (metadata.plan || "starter") as PlanId; const date = (value: unknown) => typeof value === "number" ? new Date(value * 1000) : null; return { providerCustomerId: typeof object.customer === "string" ? object.customer : null, providerSubscriptionId: typeof object.id === "string" && String(object.id).startsWith("sub_") ? object.id : typeof object.subscription === "string" ? object.subscription : null, providerEventId: event.id, plan: price, status, currentPeriodStart: date(object.current_period_start), currentPeriodEnd: date(object.current_period_end), cancelAtPeriodEnd: object.cancel_at_period_end === true, trialEnd: date(object.trial_end) }; },
};

function paystackRequest(path: string, options: RequestInit = {}) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  return fetch(`https://api.paystack.co/${path}`, { ...options, headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json", ...options.headers } });
}

export const paystackProvider: BillingProvider = {
  name: "paystack",
  capabilities: { supportsHostedCheckout: true, supportsSubscriptions: true, supportsBillingPortal: false, supportsPlanChange: false, supportsCancellation: true, supportsResume: false, supportsRecurringAuthorization: true, supportsTrials: true, supportsMultiStepAuthorization: true },

  // Legacy one-shot checkout retained for non-trial/manual use only.
  async createCheckoutSession(input) { if (input.trialPeriodDays) throw new Error("Use authorizePaymentMethod + createTrialSubscription for a Paystack trial, not createCheckoutSession."); const secret = process.env.PAYSTACK_SECRET_KEY; const amount = process.env[`PAYSTACK_AMOUNT_${input.metadata.plan.toUpperCase()}`]; const currency = process.env.SUPERKUBA_BILLING_CURRENCY || "GHS"; if (!secret || !amount || !input.metadata.email) throw new Error("Paystack billing provider is not configured."); const response = await fetch("https://api.paystack.co/transaction/initialize", { method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" }, body: JSON.stringify({ email: input.metadata.email, amount, currency, plan: input.priceId, callback_url: input.successUrl, metadata: input.metadata }) }); const data = await response.json(); if (!response.ok || !data.status) throw new Error(data.message || "Paystack checkout could not be created."); return { id: data.data.reference, url: data.data.authorization_url, customerId: data.data.customer?.customer_code || null }; },

  async verifyTransaction(reference, expected) { const response = await paystackRequest(`transaction/verify/${encodeURIComponent(reference)}`); const data = await response.json(); const transaction = data.data; if (!response.ok || !data.status || transaction?.status !== "success" || transaction?.reference !== reference) throw new Error("Paystack transaction verification failed."); const metadata = transaction.metadata || {}; if (metadata.businessId !== expected.businessId || metadata.plan !== expected.plan || transaction.currency !== expected.currency || String(transaction.amount) !== expected.amount || String(transaction.customer?.email || "").toLowerCase() !== expected.email.toLowerCase()) throw new Error("Paystack transaction does not match the expected checkout."); return { provider: "paystack", providerCustomerId: transaction.customer?.customer_code || null, providerSubscriptionId: transaction.plan_object?.subscription_code || transaction.subscription_code || null, providerEventId: `verified:${reference}`, plan: expected.plan, status: "active", currentPeriodStart: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, trialEnd: null }; },

  async cancelSubscription(subscriptionId) { const detailsResponse = await paystackRequest(`subscription/${encodeURIComponent(subscriptionId)}`); const details = await detailsResponse.json(); const emailToken = details.data?.email_token; if (!detailsResponse.ok || !emailToken) throw new Error("Paystack subscription cancellation token is unavailable."); const response = await paystackRequest("subscription/disable", { method: "POST", body: JSON.stringify({ code: subscriptionId, token: emailToken }) }); const data = await response.json(); if (!response.ok || !data.status) throw new Error(data.message || "Paystack subscription cancellation failed."); return { confirmed: true }; },
  async createPortalSession() { throw new Error("Paystack does not provide a hosted billing portal in this integration."); },

  // Step 1: initialize a small, disclosed verification charge and send the
  // customer to Paystack's own hosted page to enter their card. Paystack
  // documents no $0 authorization for standard card transactions.
  async authorizePaymentMethod(input) {
    const amount = paystackVerificationAmount(input.currency);
    if (amount == null) throw new Error(`Paystack verification is not configured for currency ${input.currency}.`);
    const response = await paystackRequest("transaction/initialize", { method: "POST", body: JSON.stringify({ email: input.email, amount, currency: input.currency, callback_url: input.callbackUrl, metadata: { businessId: input.businessId, plan: input.plan, purpose: "trial_card_verification" } }) });
    const data = await response.json();
    if (!response.ok || !data.status) throw new Error(data.message || "Unable to start Paystack card authorization.");
    return { authorizationUrl: data.data.authorization_url, reference: data.data.reference, verificationAmount: amount, currency: input.currency };
  },

  // Step 2: confirm the verification charge succeeded and extract only safe,
  // reusable references — never raw card credentials, which Paystack's hosted page
  // collects directly and never sends to SuperKuba.
  async verifyPaymentMethod(reference) {
    const response = await paystackRequest(`transaction/verify/${encodeURIComponent(reference)}`);
    const data = await response.json();
    const transaction = data.data;
    if (!response.ok || !data.status || transaction?.status !== "success" || transaction?.reference !== reference) throw new Error("Paystack card verification failed.");
    const authorization = transaction.authorization || {};
    if (!authorization.authorization_code || authorization.reusable !== true) throw new Error("This card cannot be used for a recurring SuperKuba subscription.");
    if (!transaction.customer?.customer_code) throw new Error("Paystack did not return a customer reference.");
    return {
      authorizationCode: authorization.authorization_code,
      customerCode: transaction.customer.customer_code,
      cardBrand: authorization.card_type || authorization.brand || null,
      last4: authorization.last4 || null,
      expMonth: authorization.exp_month || null,
      expYear: authorization.exp_year || null,
      bank: authorization.bank || null,
      reference,
      verificationAmount: Number(transaction.amount) || 0,
      verificationCurrency: transaction.currency || "",
      verificationRefunded: false,
    };
  },

  // Refunds the verification charge (Paystack: POST /refund). Refund timing to
  // the customer's bank is outside SuperKuba's control — never disclosed as instant.
  async refundVerificationCharge(reference) {
    const response = await paystackRequest("refund", { method: "POST", body: JSON.stringify({ transaction: reference }) });
    const data = await response.json();
    if (!response.ok || !data.status) return { refunded: false };
    return { refunded: true };
  },

  // Step 3: create the real subscription with start_date = trial end. Paystack
  // itself attempts the first charge on that date and fires a webhook — no
  // SuperKuba-side timer is required for the happy path.
  async createTrialSubscription(input) {
    const response = await paystackRequest("subscription", { method: "POST", body: JSON.stringify({ customer: input.customerCode, plan: input.planCode, authorization: input.authorizationCode, start_date: input.startDate.toISOString() }) });
    const data = await response.json();
    if (!response.ok || !data.status) throw new Error(data.message || "Unable to schedule the Paystack subscription.");
    return { subscriptionCode: data.data.subscription_code, status: data.data.status };
  },

  // Interprets an ALREADY-signature-verified Paystack webhook payload. Call
  // verifyPaystackSignature separately first — this function no longer
  // re-verifies, so callers can distinguish "invalid signature" (reject) from
  // "valid signature, nothing actionable" (acknowledge, don't retry).
  //
  // Two categories of events are deliberately ignored (return null), not
  // treated as errors:
  //   - the one-time card-verification charge (metadata.purpose ===
  //     "trial_card_verification") — it is authorization proof, never
  //     subscription activity, and is refunded synchronously in the trial
  //     callback route.
  //   - purely informational events (subscription.create, invoice.create,
  //     invoice.update) — the trial callback route is the authoritative,
  //     synchronous writer of the initial "trialing" row with a real
  //     trialEnd; letting subscription.create's confirmatory, less-complete
  //     payload overwrite it here would risk clobbering a correct trialEnd
  //     with null (which the entitlement resolver correctly treats as
  //     unusable) purely from webhook-ordering timing.
  parseWebhook(payload, signature) {
    if (!verifyPaystackSignature(payload, signature)) return null;
    const event = JSON.parse(payload) as { event: string; data: Record<string, unknown> };
    const metadata = (event.data.metadata || {}) as Record<string, string>;
    if (event.event === "charge.success" && metadata.purpose === "trial_card_verification") return null;
    const ignoredEvents = new Set(["subscription.create", "invoice.create", "invoice.update"]);
    if (ignoredEvents.has(event.event)) return null;
    let status: BillingStatus;
    if (event.event === "charge.success") status = "active";
    else if (event.event === "invoice.payment_failed") status = "past_due";
    else if (event.event === "subscription.disable" || event.event === "subscription.not_renew") status = "canceled";
    else return null;
    return { providerCustomerId: typeof event.data.customer === "string" ? event.data.customer : null, providerSubscriptionId: typeof event.data.subscription_code === "string" ? event.data.subscription_code : null, providerEventId: String(event.data.reference || crypto.randomUUID()), plan: (metadata.plan || "starter") as PlanId, status, currentPeriodStart: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, trialEnd: null };
  },
};

/** Standalone so the webhook route can distinguish an invalid signature (reject, do not retry-storm) from a valid signature carrying an event we intentionally ignore (acknowledge). */
export function verifyPaystackSignature(payload: string, signature: string | null): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha512", secret).update(payload).digest("hex");
  return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function getBillingProvider(): BillingProvider { return activeBillingProvider() === "stripe" ? stripeProvider : paystackProvider; }
