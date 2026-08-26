"use client";

import IntegrationStatusPage from "../IntegrationStatusPage";

export default function ExternalAppsIntegrationPage() {
  return <IntegrationStatusPage title="External Apps" description="Connect business tools and services to extend Kuba's operational workflows." providers={["Slack", "Microsoft Teams", "Notion", "Google Drive", "Dropbox", "Zapier", "Make"]} status="Coming Soon" notes={["No generic external-app connection or workspace authorization service is operational.", "No file import, Business Brain source mapping, collaboration command, or automation-platform webhook exists.", "Future connections must use tenant-scoped permissions and provider-specific revocation handling."]} />;
}
