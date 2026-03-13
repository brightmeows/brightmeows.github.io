import { redirect } from "@sveltejs/kit";

export const prerender = true;

export const load = () => {
  // eslint-disable-next-line @typescript-eslint/only-throw-error
  throw redirect(308, "/bms/table/mirror-proxy");
};
