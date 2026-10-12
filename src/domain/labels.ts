import type {
  AmenityId,
  Furnishing,
  ListingStatus,
  LocalityId,
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
  PropertyType,
  RentStatus,
  RequestStatus,
  TimeSlot,
  VerificationCategory,
  VerificationStatus,
} from "./types";

/** Single source of UI copy for enumerations (§13.1). */

export const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = {
  apartment: "Apartment",
  independent_house: "Independent House",
  builder_floor: "Builder Floor",
  studio: "Studio",
  single_room: "Single Room",
};

export const FURNISHING_LABEL: Record<Furnishing, string> = {
  unfurnished: "Unfurnished",
  semi_furnished: "Semi-furnished",
  fully_furnished: "Fully furnished",
};

export const LISTING_STATUS_LABEL: Record<ListingStatus, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  published: "Published",
  unavailable: "Unavailable",
};

export const VERIFICATION_CATEGORY_LABEL: Record<VerificationCategory, string> = {
  identity: "Owner identity",
  authority: "Authority to list",
  listing_accuracy: "Listing accuracy",
  availability: "Availability freshness",
};

/** The fourth status keeps the canonical label "Needs re-verification" (D-29). */
export const VERIFICATION_STATUS_LABEL: Record<VerificationStatus, string> = {
  verified_demo: "Verified (demo)",
  pending_review: "Pending review",
  not_checked: "Not yet checked",
  needs_reverification: "Needs re-verification",
};

/** Pending is the canonical initial status in both roles (D-03). */
export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "Pending",
  contacted: "Contacted",
  scheduled: "Visit Scheduled",
  completed: "Visit Completed",
  cancelled: "Cancelled",
};

export const SLOT_LABEL: Record<TimeSlot, string> = {
  morning: "Morning (9–12)",
  afternoon: "Afternoon (12–4)",
  evening: "Evening (4–7)",
};

export const RENT_STATUS_LABEL: Record<RentStatus, string> = {
  paid: "Paid (demo record)",
  due: "Due",
  overdue: "Overdue",
};

export const MAINTENANCE_STATUS_LABEL: Record<MaintenanceStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
};

export const MAINTENANCE_CATEGORY_LABEL: Record<MaintenanceCategory, string> = {
  plumbing: "Plumbing",
  electrical: "Electrical",
  appliance: "Appliance",
  cleaning: "Cleaning",
  furniture: "Furniture / Carpentry",
  other: "Other",
};

export const MAINTENANCE_PRIORITY_LABEL: Record<MaintenancePriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const AMENITY_LABEL: Record<AmenityId, string> = {
  parking: "Parking",
  wifi: "Wi-Fi",
  lift: "Lift",
  power_backup: "Power backup",
  water_24h: "24h water",
  modular_kitchen: "Modular kitchen",
  security: "Security",
  air_conditioning: "Air conditioning",
  balcony: "Balcony",
  gym_access: "Gym access",
  pet_friendly: "Pet-friendly",
  gated_society: "Gated society",
};

export const LOCALITY_LABEL: Record<LocalityId, string> = {
  malviya_nagar: "Malviya Nagar",
  c_scheme: "C-Scheme",
  vaishali_nagar: "Vaishali Nagar",
  mansarovar: "Mansarovar",
  raja_park: "Raja Park",
  bani_park: "Bani Park",
  jagatpura: "Jagatpura",
  sitapura: "Sitapura",
  jawahar_nagar: "Jawahar Nagar",
  sodala: "Sodala",
  gopalpura: "Gopalpura (Tonk Road)",
};

/** Badge tones (§14.6). Colour is never the only cue — badges always carry icon + text. */
export type Tone = "positive" | "warning" | "pending" | "neutral" | "error";

export const VERIFICATION_STATUS_TONE: Record<VerificationStatus, Tone> = {
  verified_demo: "positive",
  pending_review: "pending",
  not_checked: "neutral",
  needs_reverification: "warning",
};

export const REQUEST_STATUS_TONE: Record<RequestStatus, Tone> = {
  pending: "pending",
  contacted: "pending",
  scheduled: "pending",
  completed: "neutral",
  cancelled: "error",
};

export const LISTING_STATUS_TONE: Record<ListingStatus, Tone> = {
  draft: "neutral",
  pending_review: "pending",
  published: "positive",
  unavailable: "neutral",
};
