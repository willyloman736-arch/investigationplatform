import { describe, it, expect } from "vitest";

import { escrowProvider } from "@/lib/escrow/provider";

describe("escrowProvider.verifyWebhookSignature", () => {
  it("accepts a present signature when a secret is configured", () => {
    expect(
      escrowProvider.verifyWebhookSignature("body", "a-signature", "secret")
    ).toBe(true);
  });

  it("rejects a missing signature", () => {
    expect(escrowProvider.verifyWebhookSignature("body", null, "secret")).toBe(
      false
    );
    expect(escrowProvider.verifyWebhookSignature("body", "", "secret")).toBe(
      false
    );
  });

  it("rejects when no secret is configured (unsigned calls cannot pass)", () => {
    expect(
      escrowProvider.verifyWebhookSignature("body", "a-signature", undefined)
    ).toBe(false);
  });
});

describe("escrowProvider.requestRelease", () => {
  it("returns 'requested' and a provider reference (never moves money)", async () => {
    const res = await escrowProvider.requestRelease({
      contractId: "c1",
      amount: 1000,
      currency: "USD",
    });
    expect(res.status).toBe("requested");
    expect(typeof res.providerReference).toBe("string");
    expect(res.providerReference.length).toBeGreaterThan(0);
  });

  it("preserves a provided provider reference", async () => {
    const res = await escrowProvider.requestRelease({
      contractId: "c1",
      providerReference: "REL_EXISTING",
      amount: 1000,
      currency: "USD",
    });
    expect(res.providerReference).toBe("REL_EXISTING");
  });
});

describe("escrowProvider.confirmDepositFromWebhook", () => {
  it("marks received for a succeeded/received status", async () => {
    const a = await escrowProvider.confirmDepositFromWebhook({
      type: "charge",
      providerReference: "x",
      status: "succeeded",
      amount: 500,
      currency: "USD",
    });
    expect(a.depositStatus).toBe("received");
    expect(a.amount).toBe(500);
    expect(a.currency).toBe("USD");
  });

  it("marks received for a deposit-type event", async () => {
    const b = await escrowProvider.confirmDepositFromWebhook({
      type: "deposit.created",
      providerReference: "x",
    });
    expect(b.depositStatus).toBe("received");
  });

  it("marks failed for an unrelated/failed event", async () => {
    const c = await escrowProvider.confirmDepositFromWebhook({
      type: "charge",
      providerReference: "x",
      status: "failed",
    });
    expect(c.depositStatus).toBe("failed");
  });
});

describe("escrowProvider read helpers (mock)", () => {
  it("creates an escrow account with a reference", async () => {
    const res = await escrowProvider.createEscrowAccount({
      caseId: "case-1",
      currency: "USD",
      totalAmount: 1000,
      platformFee: 30,
      providerFee: 15,
      netReleaseAmount: 955,
    });
    expect(res.status).toBe("created");
    expect(res.providerReference.length).toBeGreaterThan(0);
  });

  it("reports provider-side release eligibility", async () => {
    const res = await escrowProvider.checkReleaseEligibility("c1");
    expect(res.eligible).toBe(true);
    expect(res.contractId).toBe("c1");
  });
});
