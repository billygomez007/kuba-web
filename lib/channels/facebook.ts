import type {
  ChannelAdapter,
} from "./types";

import {
  sendMetaMessage,
} from "./meta/outbound";

export const facebookAdapter:
  ChannelAdapter = {
    async send(payload) {
      if (!payload.integrationId) {
        return {
          success: false,
          error:
            "integration_required",
        };
      }

      return sendMetaMessage({
        businessId:
          payload.businessId,
        integrationId:
          payload.integrationId,
        recipient:
          payload.recipient,
        message:
          payload.message,
        provider:
          "facebook",
      });
    },
  };
