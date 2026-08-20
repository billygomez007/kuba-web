import {
  ChannelAdapter,
} from "./types";


export const whatsappAdapter: ChannelAdapter = {

  async send(payload) {

    console.log(
      "WhatsApp:",
      payload,
    );

    return {
      success: true,
      externalMessageId:
        crypto.randomUUID(),
    };

  },

};
