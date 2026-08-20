import {
  channelAdapters,
} from "./index";

import {
  ChannelAdapter,
  ChannelType,
} from "./types";


const adapters = channelAdapters;


export function getChannelAdapter(
  channel: ChannelType,
) {
  return adapters[channel];
}
