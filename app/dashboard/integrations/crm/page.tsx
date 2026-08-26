"use client";

import IntegrationStatusPage from "../IntegrationStatusPage";

export default function CRMIntegrationPage() {
  return <IntegrationStatusPage title="CRM" description="Connect an external CRM system to synchronize customer and sales records with Kuba." providers={["HubSpot", "Salesforce", "Pipedrive", "Zoho CRM", "Microsoft Dynamics"]} status="Coming Soon" notes={["SuperKuba Customer Operations is an internal CRM-like domain, not an external CRM connector.", "No provider OAuth, external ID mapping, sync cursor, conflict handling, or CRM webhook exists.", "A future connector must define the source of truth before AI Workforce access is enabled."]} />;
}
