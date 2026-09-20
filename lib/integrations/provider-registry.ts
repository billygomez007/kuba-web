export type IntegrationProviderDefinition = {
  id: string;
  name: string;
  category:
    | "calendar"
    | "payments"
    | "accounting"
    | "crm"
    | "external"
    | "messaging"
    | "developer"
    | "voice";
  connectionType:
    | "oauth"
    | "api_key"
    | "bot_token"
    | "webhook"
    | "platform";
  environmentKeys: string[];
  enabled: boolean;
  description: string;
};

export const integrationProviders:
  IntegrationProviderDefinition[] = [
  {
    id: "google_calendar",
    name: "Google Calendar",
    category: "calendar",
    connectionType: "oauth",
    environmentKeys: [
      "GOOGLE_INTEGRATION_CLIENT_ID",
      "GOOGLE_INTEGRATION_CLIENT_SECRET",
      "GOOGLE_INTEGRATION_REDIRECT_URI",
    ],
    enabled: true,
    description:
      "Connect Google Calendar for availability and appointment scheduling.",
  },
  {
    id: "microsoft_calendar",
    name: "Microsoft Outlook Calendar",
    category: "calendar",
    connectionType: "oauth",
    environmentKeys: [
      "MICROSOFT_CLIENT_ID",
      "MICROSOFT_CLIENT_SECRET",
      "MICROSOFT_TENANT_ID",
      "MICROSOFT_INTEGRATION_REDIRECT_URI",
    ],
    enabled: true,
    description:
      "Connect Microsoft 365 calendars and scheduling.",
  },
  {
    id: "apple_calendar",
    name: "Apple Calendar",
    category: "calendar",
    connectionType: "api_key",
    environmentKeys: [],
    enabled: true,
    description:
      "Connect Apple/iCloud Calendar using tenant-provided CalDAV credentials.",
  },

  {
    id: "stripe_merchant",
    name: "Stripe",
    category: "payments",
    connectionType: "oauth",
    environmentKeys: [
      "STRIPE_CONNECT_CLIENT_ID",
      "STRIPE_SECRET_KEY",
    ],
    enabled: false,
    description:
      "Connect a business Stripe merchant account.",
  },
  {
    id: "paystack_merchant",
    name: "Paystack",
    category: "payments",
    connectionType: "api_key",
    environmentKeys: [],
    enabled: true,
    description:
      "Connect a tenant-owned Paystack merchant account.",
  },

  {
    id: "quickbooks",
    name: "QuickBooks Online",
    category: "accounting",
    connectionType: "oauth",
    environmentKeys: [
      "QUICKBOOKS_CLIENT_ID",
      "QUICKBOOKS_CLIENT_SECRET",
      "QUICKBOOKS_REDIRECT_URI",
    ],
    enabled: true,
    description:
      "Synchronize customers, invoices, payments and accounting records.",
  },
  {
    id: "xero",
    name: "Xero",
    category: "accounting",
    connectionType: "oauth",
    environmentKeys: [
      "XERO_CLIENT_ID",
      "XERO_CLIENT_SECRET",
      "XERO_REDIRECT_URI",
    ],
    enabled: false,
    description:
      "Synchronize Xero accounting records.",
  },
  {
    id: "sage",
    name: "Sage",
    category: "accounting",
    connectionType: "oauth",
    environmentKeys: [
      "SAGE_CLIENT_ID",
      "SAGE_CLIENT_SECRET",
      "SAGE_REDIRECT_URI",
    ],
    enabled: false,
    description:
      "Connect supported Sage accounting services.",
  },
  {
    id: "zoho_books",
    name: "Zoho Books",
    category: "accounting",
    connectionType: "oauth",
    environmentKeys: [
      "ZOHO_CLIENT_ID",
      "ZOHO_CLIENT_SECRET",
      "ZOHO_REDIRECT_URI",
    ],
    enabled: false,
    description:
      "Synchronize Zoho Books financial records.",
  },

  {
    id: "hubspot",
    name: "HubSpot",
    category: "crm",
    connectionType: "oauth",
    environmentKeys: [
      "HUBSPOT_CLIENT_ID",
      "HUBSPOT_CLIENT_SECRET",
      "HUBSPOT_REDIRECT_URI",
    ],
    enabled: true,
    description:
      "Synchronize contacts, companies, leads and deals.",
  },
  {
    id: "salesforce",
    name: "Salesforce",
    category: "crm",
    connectionType: "oauth",
    environmentKeys: [
      "SALESFORCE_CLIENT_ID",
      "SALESFORCE_CLIENT_SECRET",
      "SALESFORCE_REDIRECT_URI",
    ],
    enabled: true,
    description:
      "Connect Salesforce CRM records.",
  },
  {
    id: "pipedrive",
    name: "Pipedrive",
    category: "crm",
    connectionType: "oauth",
    environmentKeys: [
      "PIPEDRIVE_CLIENT_ID",
      "PIPEDRIVE_CLIENT_SECRET",
      "PIPEDRIVE_REDIRECT_URI",
    ],
    enabled: true,
    description:
      "Synchronize Pipedrive contacts and deals.",
  },
  {
    id: "zoho_crm",
    name: "Zoho CRM",
    category: "crm",
    connectionType: "oauth",
    environmentKeys: [
      "ZOHO_CLIENT_ID",
      "ZOHO_CLIENT_SECRET",
      "ZOHO_REDIRECT_URI",
    ],
    enabled: true,
    description:
      "Connect Zoho CRM customers and pipeline.",
  },
  {
    id: "microsoft_dynamics",
    name: "Microsoft Dynamics 365",
    category: "crm",
    connectionType: "oauth",
    environmentKeys: [
      "MICROSOFT_CLIENT_ID",
      "MICROSOFT_CLIENT_SECRET",
      "MICROSOFT_TENANT_ID",
      "MICROSOFT_DYNAMICS_REDIRECT_URI",
    ],
    enabled: true,
    description:
      "Connect Microsoft Dynamics 365 CRM.",
  },

  {
    id: "slack",
    name: "Slack",
    category: "external",
    connectionType: "oauth",
    environmentKeys: [
      "SLACK_CLIENT_ID",
      "SLACK_CLIENT_SECRET",
      "SLACK_REDIRECT_URI",
    ],
    enabled: true,
    description:
      "Connect Slack for operational notifications and workflows.",
  },
  {
    id: "microsoft_teams",
    name: "Microsoft Teams",
    category: "external",
    connectionType: "oauth",
    environmentKeys: [
      "MICROSOFT_CLIENT_ID",
      "MICROSOFT_CLIENT_SECRET",
      "MICROSOFT_TENANT_ID",
      "MICROSOFT_TEAMS_REDIRECT_URI",
    ],
    enabled: true,
    description:
      "Connect Microsoft Teams for collaboration workflows.",
  },
  {
    id: "notion",
    name: "Notion",
    category: "external",
    connectionType: "oauth",
    environmentKeys: [
      "NOTION_CLIENT_ID",
      "NOTION_CLIENT_SECRET",
      "NOTION_REDIRECT_URI",
    ],
    enabled: true,
    description:
      "Connect Notion workspace knowledge to Business Brain.",
  },
  {
    id: "google_drive",
    name: "Google Drive",
    category: "external",
    connectionType: "oauth",
    environmentKeys: [
      "GOOGLE_INTEGRATION_CLIENT_ID",
      "GOOGLE_INTEGRATION_CLIENT_SECRET",
      "GOOGLE_DRIVE_REDIRECT_URI",
    ],
    enabled: true,
    description:
      "Connect Google Drive files to Business Brain.",
  },
  {
    id: "dropbox",
    name: "Dropbox",
    category: "external",
    connectionType: "oauth",
    environmentKeys: [
      "DROPBOX_CLIENT_ID",
      "DROPBOX_CLIENT_SECRET",
      "DROPBOX_REDIRECT_URI",
    ],
    enabled: true,
    description:
      "Connect Dropbox documents and files.",
  },
  {
    id: "zapier",
    name: "Zapier",
    category: "external",
    connectionType: "webhook",
    environmentKeys: [],
    enabled: true,
    description:
      "Connect SuperKuba workflows through secure Zapier webhooks.",
  },
  {
    id: "make",
    name: "Make",
    category: "external",
    connectionType: "webhook",
    environmentKeys: [],
    enabled: true,
    description:
      "Connect SuperKuba workflows to Make scenarios.",
  },

  {
    id: "telegram",
    name: "Telegram",
    category: "messaging",
    connectionType: "bot_token",
    environmentKeys: [],
    enabled: false,
    description:
      "Connect a tenant-owned Telegram Bot.",
  },
  {
    id: "voice",
    name: "Voice",
    category: "voice",
    connectionType: "platform",
    environmentKeys: [],
    enabled: true,
    description:
      "Manage existing SuperKuba voice providers and AI phone numbers.",
  },

  {
    id: "developer_api",
    name: "SuperKuba Developer API",
    category: "developer",
    connectionType: "platform",
    environmentKeys: [],
    enabled: true,
    description:
      "Create tenant-scoped API keys and webhook endpoints.",
  },
];

export function getIntegrationProvider(
  providerId: string,
) {
  return integrationProviders.find(
    (provider) =>
      provider.id === providerId,
  );
}

export function providersForCategory(
  category:
    IntegrationProviderDefinition["category"],
) {
  return integrationProviders.filter(
    (provider) =>
      provider.category === category,
  );
}

export function providerEnvironmentReady(
  provider:
    IntegrationProviderDefinition,
) {
  if (
    provider.environmentKeys.length === 0
  ) {
    return true;
  }

  return provider.environmentKeys.every(
    (key) =>
      Boolean(
        process.env[key]?.trim(),
      ),
  );
}
