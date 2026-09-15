import {
  whatsappAdapter,
} from "./whatsapp";

import {
  facebookAdapter,
} from "./facebook";

import {
  instagramAdapter,
} from "./instagram";

import {
  emailAdapter,
} from "./email";


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
    emailAdapter,

  sms:
    whatsappAdapter,

  website:
    whatsappAdapter,

};
