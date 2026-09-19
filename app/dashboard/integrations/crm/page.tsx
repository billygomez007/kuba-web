import ProviderGrid from "@/app/components/integrations/ProviderGrid";

export default function CRMIntegrationPage() {
  return (
    <ProviderGrid
      category="crm"
      title="CRM Integrations"
      description="Connect HubSpot, Salesforce, Pipedrive, Zoho CRM, or Microsoft Dynamics 365 while preserving SuperKuba tenant isolation."
    />
  );
}
