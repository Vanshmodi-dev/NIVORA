import type { VerificationCategory, VerificationStatus } from "./types";

/**
 * Plain-language trust copy shared by the property trust block and the Trust Center (§8.2, §8.3).
 * Every claim is bounded: verification is demo data and never a guarantee.
 */
export const TRUST_CATEGORY_INFO: Record<VerificationCategory, { question: string; covers: string; doesNotCover: string }> = {
  identity: {
    question: "Has the listing owner's identity been checked?",
    covers: "The listing owner is who they say they are.",
    doesNotCover: "Does not prove they own or may rent the property.",
  },
  authority: {
    question: "Has the owner's right to list this property been checked?",
    covers: "The owner owns the property or is authorised to rent it.",
    doesNotCover: "Does not prove the details and photos are accurate. Identity is a separate check from ownership.",
  },
  listing_accuracy: {
    question: "Do the photos and details match the property?",
    covers: "Photos, rent and specifications correspond to the property.",
    doesNotCover: "Does not guarantee condition, the behaviour of any party, or the absence of fraud.",
  },
  availability: {
    question: "Was availability confirmed recently?",
    covers: "The owner confirmed the home is still available recently.",
    doesNotCover: "Does not reserve the home for anyone.",
  },
};

export const TRUST_STATUS_INFO: Record<VerificationStatus, { means: string; doesNotMean: string }> = {
  verified_demo: {
    means: "In this prototype's demo data, this check is marked complete.",
    doesNotMean: "That a real check happened, or that the listing is risk-free.",
  },
  pending_review: {
    means: "Information was submitted and is waiting for a (simulated) review.",
    doesNotMean: "That it passed or failed.",
  },
  not_checked: {
    means: "Nothing has been submitted or reviewed for this check yet.",
    doesNotMean: "That anything is wrong.",
  },
  needs_reverification: {
    means: "A check that was done earlier is now out of date.",
    doesNotMean: "That the home is unavailable or unsafe.",
  },
};

/** One-line explanation shown under each row (specific to category + status). */
export function trustRowExplanation(category: VerificationCategory, status: VerificationStatus): string {
  switch (status) {
    case "verified_demo":
      return category === "availability"
        ? "The owner confirmed availability recently (demo data)."
        : `${TRUST_CATEGORY_INFO[category].covers} Marked complete in demo data.`;
    case "pending_review":
      return "Information has been submitted and is awaiting review (simulated).";
    case "not_checked":
      return "Nothing has been submitted for this check yet.";
    case "needs_reverification":
      return category === "availability"
        ? "Availability was last confirmed a while ago and needs to be confirmed again."
        : "This check was done earlier and needs to be done again.";
  }
}

export const NOT_CLAIMED = [
  "NIVORA does not guarantee that any listing is free of fraud or risk.",
  "A status describes one check only. It never means the whole listing, owner or home is trustworthy.",
  "In this prototype every status is fictional demo data — no real person, property or document has been verified.",
  "NIVORA has not physically inspected any property shown here.",
] as const;

export const FUTURE_VERIFICATION_NOTE =
  "Future concept — not available. A real product could add identity checks through approved providers, document review and site visits, each subject to legal and regulatory design. None of this exists in the prototype.";
