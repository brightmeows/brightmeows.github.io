import { deLocalizeUrl } from "./lib/paraglide/runtime.js";

export const reroute = ({ url }: { url: URL }) => deLocalizeUrl(url).pathname;

export const transport = {};
