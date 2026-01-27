export function validateApiKey(headers: Headers): boolean {
  const apiKey = headers.get("X-API-KEY");
  const expectedKey = process.env.EXTENSION_API_KEY;

  if (!apiKey || !expectedKey) return false;

  return apiKey === expectedKey;
}
