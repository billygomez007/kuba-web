import {
  whatsappAdapter,
} from "./whatsapp";

import {
  facebookAdapter,
} from "./facebook";

import {
  instagramAdapter,
} from "./instagram";


export const channelAdapters = {

  whatsapp:
    whatsappAdapter,

  facebook:
    facebookAdapter,

  instagram:
    instagramAdapter,

  telegram:
    whatsappAdapter,

  email:
    whatsappAdapter,

  sms:
    whatsappAdapter,

  website:
    whatsappAdapter,

};
