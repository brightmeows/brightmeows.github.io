import { deLocalizeUrl } from "./lib/paraglide/runtime.js";

const I18N_PREFIX = "/demo/paraglide";

export const reroute = ({ url }: { url: URL }) => {
  if (url.pathname.startsWith(I18N_PREFIX)) {
    return deLocalizeUrl(url).pathname;
  }
  return url.pathname;
};

export const transport = {};
