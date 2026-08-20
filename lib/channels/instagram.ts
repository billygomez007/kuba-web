import {
  ChannelAdapter,
} from "./types";


export const instagramAdapter: ChannelAdapter = {

  async send(payload) {

    console.log(
      "Instagram:",
      payload,
    );

    return {
      success: true,
      externalMessageId:
        crypto.randomUUID(),
    };

  },

};
