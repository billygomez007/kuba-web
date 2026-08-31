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
  recipient: string;
  message: string;
}


export interface ChannelAdapter {

  send(
    payload: SendMessagePayload
  ): Promise<{
    success: boolean;
    externalMessageId?: string;
    error?: string;
  }>;

}
