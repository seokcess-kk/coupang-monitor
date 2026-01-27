import { describe, it, expect } from "vitest";
import { GET } from "../app/api/health/route";

describe("GET /api/health", () => {
  it("should return a response", async () => {
    const response = await GET();
    expect(response).toBeDefined();
    expect(response.status).toBeDefined();
  });

  it("should return JSON body with status field", async () => {
    const response = await GET();
    const body = await response.json();
    expect(body).toHaveProperty("status");
    expect(["ok", "error"]).toContain(body.status);
  });

  it("should return db field in response", async () => {
    const response = await GET();
    const body = await response.json();
    expect(body).toHaveProperty("db");
    expect(["connected", "disconnected"]).toContain(body.db);
  });
});
