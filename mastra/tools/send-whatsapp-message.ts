import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { requireBusinessId } from "./business-context";

export const sendWhatsAppMessageTool = createTool({
  id: "send-whatsapp-message",

  description:
    "Send a WhatsApp text message to a lead using the business WhatsApp Cloud API. Use only when the user explicitly asks Kuba to send/contact/message a lead and the lead phone number is available. A successful result means Meta accepted the message and returned a WhatsApp message ID.",

  inputSchema: z.object({
    phone: z
      .string()
      .describe(
        "The recipient WhatsApp phone number in international format.",
      ),

    message: z
      .string()
      .min(1)
      .describe("The exact WhatsApp message to send."),
  }),

  execute: async ({
    phone,
    message,
  }, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    const accessToken =
      process.env.WHATSAPP_ACCESS_TOKEN;

    const phoneNumberId =
      process.env.WHATSAPP_PHONE_NUMBER_ID;

    const configuredBusinessId =
      process.env.WHATSAPP_BUSINESS_ID;

    const graphApiVersion =
      process.env.WHATSAPP_GRAPH_API_VERSION ||
      "v25.0";

    if (!accessToken || !phoneNumberId) {
      return {
        success: false,
        error:
          "WhatsApp credentials are not configured.",
      };
    }

    if (
      configuredBusinessId &&
      configuredBusinessId !== businessId
    ) {
      return {
        success: false,
        error:
          "The configured WhatsApp business does not match the current business.",
      };
    }

    const recipient = phone.trim();

    if (!recipient) {
      return {
        success: false,
        error:
          "A recipient phone number is required.",
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
          to: recipient,
          type: "text",
          text: {
            preview_url: false,
            body: message,
          },
        }),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      console.error(
        "Kuba Sales WhatsApp send error:",
        JSON.stringify(result, null, 2),
      );

      return {
        success: false,
        error:
          "WhatsApp message could not be sent.",
        details: result,
      };
    }

    const externalMessageId =
      result.messages?.[0]?.id || null;

    if (!externalMessageId) {
      return {
        success: false,
        error:
          "WhatsApp accepted the request but did not return a message ID.",
      };
    }

    return {
      success: true,
      phone: recipient,
      message,
      externalMessageId,
    };
  },
});
