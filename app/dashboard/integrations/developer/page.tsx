import ProviderGrid from "@/app/components/integrations/ProviderGrid";

export default function DeveloperIntegrationsPage() {
  return (
    <ProviderGrid
      category="developer"
      title="API & Developer Integrations"
      description="Manage tenant-scoped programmatic access, API keys and webhooks for this business."
    />
  );
}
