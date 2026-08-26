"use client";

import IntegrationStatusPage from "../IntegrationStatusPage";

export default function PaymentsIntegrationPage() {
  return <IntegrationStatusPage title="Payments" description="Connect a merchant payment provider so Kuba can support customer payment workflows." providers={["Stripe merchant", "Paystack merchant"]} status="Not Configured" notes={["Stripe and Paystack are currently used for SuperKuba platform subscriptions under Billing & Subscription.", "No merchant connection, payment link, invoice, charge, refund, or customer payment-status API exists.", "This page has no payment actions and cannot process real money in staging."]} />;
}
