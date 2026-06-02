import { describe, it, expect } from "vitest";

import {
  bothPartiesApproved,
  hasAdminReleaseEligibility,
  isReleaseEligible,
  evaluateRelease,
  canSubmitApproval,
  isValidReason,
  type EscrowRuleState,
  type ApprovalRecord,
} from "@/lib/escrow/rules";

/** A funded, escrowed contract with no approvals yet (the common base). */
const escrow = (over: Partial<EscrowRuleState> = {}): EscrowRuleState => ({
  escrow_status: "securely_escrowed",
  deposit_status: "received",
  release_status: "not_started",
  release_eligibility_reason: null,
  ...over,
});

const approvals = (a: boolean, b: boolean): ApprovalRecord[] => [
  { party_role: "party_a", approved: a },
  { party_role: "party_b", approved: b },
];

describe("bothPartiesApproved", () => {
  it("is true only when BOTH parties approved", () => {
    expect(bothPartiesApproved(approvals(true, true))).toBe(true);
  });

  it("is false when only one party approved", () => {
    expect(bothPartiesApproved(approvals(true, false))).toBe(false);
    expect(bothPartiesApproved(approvals(false, true))).toBe(false);
  });

  it("is false for no approvals / null / empty", () => {
    expect(bothPartiesApproved(approvals(false, false))).toBe(false);
    expect(bothPartiesApproved([])).toBe(false);
    expect(bothPartiesApproved(null)).toBe(false);
    expect(bothPartiesApproved(undefined)).toBe(false);
  });

  it("ignores an observer and unrelated rows", () => {
    expect(
      bothPartiesApproved([
        { party_role: "observer", approved: true },
        { party_role: "party_a", approved: true },
      ])
    ).toBe(false);
  });

  it("requires approved === true (not just a present row)", () => {
    expect(
      bothPartiesApproved([
        { party_role: "party_a", approved: null },
        { party_role: "party_b", approved: true },
      ])
    ).toBe(false);
  });
});

describe("hasAdminReleaseEligibility", () => {
  it("is true when eligible AND a non-empty reason is stored", () => {
    expect(
      hasAdminReleaseEligibility({
        release_status: "eligible",
        release_eligibility_reason: "Dispute resolved to release.",
      })
    ).toBe(true);
  });

  it("is false when eligible but reason is empty/whitespace/null", () => {
    expect(
      hasAdminReleaseEligibility({
        release_status: "eligible",
        release_eligibility_reason: "   ",
      })
    ).toBe(false);
    expect(
      hasAdminReleaseEligibility({
        release_status: "eligible",
        release_eligibility_reason: null,
      })
    ).toBe(false);
  });

  it("is false when release_status is not 'eligible'", () => {
    expect(
      hasAdminReleaseEligibility({
        release_status: "not_started",
        release_eligibility_reason: "has a reason",
      })
    ).toBe(false);
  });
});

describe("isReleaseEligible", () => {
  it("passes via mutual approval", () => {
    expect(isReleaseEligible(escrow(), approvals(true, true))).toBe(true);
  });

  it("passes via admin eligibility", () => {
    expect(
      isReleaseEligible(
        escrow({ release_status: "eligible", release_eligibility_reason: "ok" }),
        approvals(false, false)
      )
    ).toBe(true);
  });

  it("fails when neither path is satisfied", () => {
    expect(isReleaseEligible(escrow(), approvals(true, false))).toBe(false);
  });
});

describe("evaluateRelease — guard rails (checked before eligibility)", () => {
  it("blocks an already-released escrow", () => {
    const r = evaluateRelease(
      escrow({ escrow_status: "released" }),
      approvals(true, true)
    );
    expect(r.ok).toBe(false);
    expect(r.code).toBe("already_released");
  });

  it("blocks when release_status is already completed", () => {
    const r = evaluateRelease(
      escrow({ release_status: "completed" }),
      approvals(true, true)
    );
    expect(r.ok).toBe(false);
    expect(r.code).toBe("already_released");
  });

  it("blocks a frozen release", () => {
    const r = evaluateRelease(
      escrow({ escrow_status: "release_frozen" }),
      approvals(true, true)
    );
    expect(r.ok).toBe(false);
    expect(r.code).toBe("frozen");
  });

  it("blocks while under dispute audit", () => {
    const r = evaluateRelease(
      escrow({ escrow_status: "under_dispute_audit" }),
      approvals(true, true)
    );
    expect(r.ok).toBe(false);
    expect(r.code).toBe("under_dispute");
  });

  it("blocks when the deposit has not been received", () => {
    const r = evaluateRelease(
      escrow({ deposit_status: "awaiting" }),
      approvals(true, true)
    );
    expect(r.ok).toBe(false);
    expect(r.code).toBe("deposit_not_received");
  });

  it("guard rails take precedence over (in)eligibility", () => {
    // Released + not eligible -> still reports already_released, not not_eligible.
    const r = evaluateRelease(
      escrow({ escrow_status: "released" }),
      approvals(false, false)
    );
    expect(r.code).toBe("already_released");
  });
});

describe("evaluateRelease — eligibility", () => {
  it("rejects when funded but neither approval path is met (403 path)", () => {
    const r = evaluateRelease(escrow(), approvals(true, false));
    expect(r.ok).toBe(false);
    expect(r.code).toBe("not_eligible");
  });

  it("allows via mutual approval and tags the path", () => {
    const r = evaluateRelease(escrow(), approvals(true, true));
    expect(r.ok).toBe(true);
    expect(r.code).toBeNull();
    expect(r.via).toBe("mutual_approval");
    expect(r.reason).toMatch(/both parties/i);
  });

  it("allows via admin eligibility and surfaces the stored reason", () => {
    const r = evaluateRelease(
      escrow({
        escrow_status: "ready_for_release",
        release_status: "eligible",
        release_eligibility_reason: "Dispute resolved to release: refund denied.",
      }),
      approvals(false, false)
    );
    expect(r.ok).toBe(true);
    expect(r.via).toBe("admin_eligibility");
    expect(r.reason).toContain("Dispute resolved to release");
  });
});

describe("canSubmitApproval", () => {
  it("allows approvals while securely escrowed or pending deposit", () => {
    expect(canSubmitApproval({ escrow_status: "securely_escrowed" }).ok).toBe(
      true
    );
    expect(canSubmitApproval({ escrow_status: "pending_deposit" }).ok).toBe(true);
    expect(canSubmitApproval({ escrow_status: "ready_for_release" }).ok).toBe(
      true
    );
  });

  it("pauses approvals while frozen or under dispute", () => {
    expect(canSubmitApproval({ escrow_status: "release_frozen" }).ok).toBe(false);
    expect(canSubmitApproval({ escrow_status: "under_dispute_audit" }).ok).toBe(
      false
    );
  });

  it("closes approvals once released", () => {
    const r = canSubmitApproval({ escrow_status: "released" });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/already been released/i);
  });
});

describe("isValidReason", () => {
  it("requires a non-empty, non-whitespace string", () => {
    expect(isValidReason("Investigated and cleared")).toBe(true);
    expect(isValidReason("")).toBe(false);
    expect(isValidReason("   ")).toBe(false);
    expect(isValidReason(null)).toBe(false);
    expect(isValidReason(undefined)).toBe(false);
  });
});
