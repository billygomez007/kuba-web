import {
  ChannelAdapter,
} from "./types";


export const facebookAdapter: ChannelAdapter = {

  async send(payload) {

    console.log(
      "Facebook:",
      payload,
    );

    return {
      success: true,
      externalMessageId:
        crypto.randomUUID(),
    };

  },

};
