export type MetaChannel =
  | "facebook_messenger"
  | "instagram";

export type MetaIntegrationMetadata = {
  channel: MetaChannel;
  pageId?: string | null;
  pageName?: string | null;
  instagramAccountId?: string | null;
  instagramUsername?: string | null;
  graphApiVersion?: string | null;
};

export type MetaInboundMessage = {
  channel: MetaChannel;
  externalAccountId: string;
  externalMessageId: string;
  senderId: string;
  senderName?: string | null;
  text: string;
  timestamp?: number | null;
};
