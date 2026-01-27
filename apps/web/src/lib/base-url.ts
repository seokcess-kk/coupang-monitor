import { headers } from "next/headers";

export function getBaseUrl() {
  const headerList = headers();
  const host = headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  if (!host) {
    return "";
  }
  return `${protocol}://${host}`;
}
