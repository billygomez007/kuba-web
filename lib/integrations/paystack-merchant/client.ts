import { decrypt, encrypt } from "@/lib/encryption";

const PAYSTACK_API = "https://api.paystack.co";

export type PaystackMerchantIdentity = {
  id: number | string;
  email: string | null;
  businessName: string | null;
  currency: string | null;
};

type PaystackResponse<T> = {
  status: boolean;
  message: string;
  data: T;
};

async function paystackRequest<T>(
  secretKey: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!secretKey.startsWith("sk_")) {
    throw new Error("Invalid Paystack secret key.");
  }

  const response = await fetch(`${PAYSTACK_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });

  const body = (await response.json()) as PaystackResponse<T>;

  if (!response.ok || !body.status) {
    throw new Error(body.message || "Paystack request failed.");
  }

  return body.data;
}

export async function verifyPaystackMerchant(
  secretKey: string,
): Promise<PaystackMerchantIdentity> {
  const data = await paystackRequest<Record<string, unknown>>(
    secretKey,
    "/integration/payment_session_timeout",
  );

  const keyResponse = await paystackRequest<Record<string, unknown>>(
    secretKey,
    "/transaction?perPage=1&page=1",
  );

  void data;

  return {
    id: String(
      keyResponse.id ??
      keyResponse.domain ??
      keyResponse.reference ??
      "paystack-merchant",
    ),
    email:
      typeof keyResponse.email === "string"
        ? keyResponse.email
        : null,
    businessName:
      typeof keyResponse.business_name === "string"
        ? keyResponse.business_name
        : null,
    currency:
      typeof keyResponse.currency === "string"
        ? keyResponse.currency
        : null,
  };
}

export async function verifyPaystackTransactionAccess(
  secretKey: string,
): Promise<void> {
  await paystackRequest(secretKey, "/transaction?perPage=1&page=1");
}

export async function initializePaystackMerchantTransaction(
  secretKey: string,
  input: {
    email: string;
    amount: number;
    currency?: string;
    reference?: string;
    callbackUrl?: string;
    metadata?: Record<string, unknown>;
  },
) {
  return paystackRequest<Record<string, unknown>>(
    secretKey,
    "/transaction/initialize",
    {
      method: "POST",
      body: JSON.stringify({
        email: input.email,
        amount: input.amount,
        currency: input.currency,
        reference: input.reference,
        callback_url: input.callbackUrl,
        metadata: input.metadata,
      }),
    },
  );
}

export function encryptPaystackSecret(secretKey: string) {
  return encrypt(secretKey);
}

export function decryptPaystackSecret(value: string) {
  return decrypt(value);
}
