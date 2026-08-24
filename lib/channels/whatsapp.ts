import {
  ChannelAdapter,
} from "./types";


export const whatsappAdapter: ChannelAdapter = {

  async send(payload) {

    const accessToken =
      process.env.WHATSAPP_ACCESS_TOKEN;

    const phoneNumberId =
      process.env.WHATSAPP_PHONE_NUMBER_ID;

    const graphApiVersion =
      process.env.WHATSAPP_GRAPH_API_VERSION ||
      "v25.0";

    if (!accessToken || !phoneNumberId) {
      return {
        success: false,
      };
    }

    const response = await fetch(
      `https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: payload.recipient,
          type: "text",
          text: {
            preview_url: false,
            body: payload.message,
          },
        }),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      console.error(
        "WhatsApp channel adapter send error:",
        JSON.stringify(result, null, 2),
      );

      return {
        success: false,
      };
    }

    const externalMessageId =
      result.messages?.[0]?.id;

    if (!externalMessageId) {
      return {
        success: false,
      };
    }

    return {
      success: true,
      externalMessageId,
    };

  },

};
