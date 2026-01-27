import { describe, it, expect } from "vitest";

describe("@pricewatch/db", () => {
  it("should export prisma client", async () => {
    const { prisma } = await import("../src/index");
    expect(prisma).toBeDefined();
    expect(typeof prisma.$connect).toBe("function");
    expect(typeof prisma.$disconnect).toBe("function");
  });

  it("should export PrismaClient class", async () => {
    const { PrismaClient } = await import("../src/index");
    expect(PrismaClient).toBeDefined();
  });

  it("should have Item model available", async () => {
    const { prisma } = await import("../src/index");
    expect(prisma.item).toBeDefined();
  });

  it("should have Variant model available", async () => {
    const { prisma } = await import("../src/index");
    expect(prisma.variant).toBeDefined();
  });

  it("should have Snapshot model available", async () => {
    const { prisma } = await import("../src/index");
    expect(prisma.snapshot).toBeDefined();
  });

  it("should have PriceEvent model available", async () => {
    const { prisma } = await import("../src/index");
    expect(prisma.priceEvent).toBeDefined();
  });

  it("should have Job model available", async () => {
    const { prisma } = await import("../src/index");
    expect(prisma.job).toBeDefined();
  });
});
