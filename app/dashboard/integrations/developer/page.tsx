"use client";

import IntegrationStatusPage from "../IntegrationStatusPage";

export default function DeveloperIntegrationsPage() {
  return <IntegrationStatusPage title="API & Developer Integrations" description="Build custom integrations and connect to Kuba programmatically when the public developer surface is available." providers={["Public API", "API keys", "Webhooks", "OAuth applications"]} status="Coming Soon" notes={["The existing developer API-key model is partner-scoped, not an operational business-facing API console.", "No tenant-owned API key lifecycle, public API authentication, customer webhooks, or supported SDK is available here.", "No documentation links are presented as operational API guidance until the underlying endpoints exist."]} />;
}
