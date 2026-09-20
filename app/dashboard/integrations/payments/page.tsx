import ProviderGrid from "@/app/components/integrations/ProviderGrid";

export default function PaymentsIntegrationPage() {
  return (
    <ProviderGrid
      category="payments"
      title="Merchant Payments"
      description="Connect tenant-owned Stripe or Paystack merchant accounts. SuperKuba subscription billing remains separate from customer merchant payments."
    />
  );
}
