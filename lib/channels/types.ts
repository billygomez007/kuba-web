export type ChannelType =
  | "whatsapp"
  | "facebook"
  | "instagram"
  | "telegram"
  | "email"
  | "sms"
  | "website";


export interface SendMessagePayload {
  businessId: string;
  conversationId: string;
  // The conversation's own bound integration (conversations.integrationId,
  // NOT NULL in schema). Optional here only because not every caller of a
  // ChannelAdapter has a conversation record (e.g. AI-tool-initiated sends
  // that know only a businessId + phone number) — a channel adapter that
  // can resolve a specific integration should always prefer this over
  // re-picking "any active integration for this business", since a
  // business can have more than one active integration for the same
  // provider (e.g. mid-migration from Meta to WATI).
  integrationId?: string;
  recipient: string;
  message: string;
  subject?: string;
  replyTo?: string;
}


export interface ChannelAdapter {

  send(
    payload: SendMessagePayload
  ): Promise<{
    success: boolean;
    externalMessageId?: string;
    replyTo?: string;
    error?: string;
  }>;

}
