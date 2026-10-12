import { AMENITY_IDS, LOCALITIES } from "../data/reference";
import { addDays, startOfDay, toISODate } from "./dates";
import { formatRupees } from "./format";
import type { AmenityId, Furnishing, LocalityId, Property, PropertyType } from "./types";
import { NAME_ERROR, PHONE_ERROR, normalizePhone } from "./validators";

/**
 * The Add / Edit Property form (blueprint §7.4). The form keeps raw strings (what the user typed)
 * and validates per step; `parseListing` turns a fully valid form into typed values. Used by the
 * wizard AND by the store mutations, so a UI bug cannot create an invalid property.
 */
export interface ListingForm {
  type: PropertyType | "";
  title: string;
  description: string;
  locality: LocalityId | "";
  addressArea: string;
  landmark: string;
  rent: string;
  deposit: string;
  maintenanceCharge: string;
  maintenanceIncluded: boolean;
  availableFrom: string;
  bedrooms: string;
  bathrooms: string;
  furnishing: Furnishing | "";
  sizeSqft: string;
  amenities: AmenityId[];
  photoIds: string[];
  /** Step 7: mock "sample document (demo)" toggles. No file is ever collected. */
  sampleIdentity: boolean;
  sampleAuthority: boolean;
  /** Step 8 */
  contactName: string;
  contactPhone: string;
  acknowledged: boolean;
}

export const EMPTY_LISTING: ListingForm = {
  type: "",
  title: "",
  description: "",
  locality: "",
  addressArea: "",
  landmark: "",
  rent: "",
  deposit: "",
  maintenanceCharge: "",
  maintenanceIncluded: true,
  availableFrom: "",
  bedrooms: "",
  bathrooms: "",
  furnishing: "",
  sizeSqft: "",
  amenities: [],
  photoIds: [],
  sampleIdentity: false,
  sampleAuthority: false,
  contactName: "",
  contactPhone: "",
  acknowledged: false,
};

export type ListingErrors = Partial<Record<keyof ListingForm, string>>;

export interface WizardStep {
  id: number;
  label: string;
  fields: (keyof ListingForm)[];
}

export const WIZARD_STEPS: readonly WizardStep[] = [
  { id: 1, label: "Basic information", fields: ["type", "title", "description"] },
  { id: 2, label: "Location", fields: ["locality", "addressArea", "landmark"] },
  { id: 3, label: "Rental details", fields: ["rent", "deposit", "maintenanceCharge", "availableFrom"] },
  { id: 4, label: "Specifications", fields: ["bedrooms", "bathrooms", "furnishing", "sizeSqft"] },
  { id: 5, label: "Amenities", fields: [] },
  { id: 6, label: "Photographs", fields: ["photoIds"] },
  { id: 7, label: "Verification", fields: [] },
  { id: 8, label: "Review & publish", fields: ["contactName", "contactPhone", "acknowledged"] },
];

export const MAX_PHOTOS = 6;
export const MIN_RENT = 1000;
export const MAX_RENT_LISTING = 300_000;

const CONTACT_PATTERN = /(\d[\s-]?){10,}|[\w.+-]+@[\w-]+\.[\w.]+/;
const digits = (s: string) => s.replace(/[^\d]/g, "");
const intOrNull = (s: string): number | null => (/^\d+$/.test(s.trim()) ? parseInt(s.trim(), 10) : null);

/** Studios and single rooms are always one room (§7.4 step 4). */
export function isSingleRoomType(type: PropertyType | ""): boolean {
  return type === "studio" || type === "single_room";
}

export interface ValidationContext {
  today: Date;
  /** True when the owner profile has no name/phone yet — step 8 then asks for them. */
  needContact: boolean;
  /**
   * When editing, the listing's existing available-from date. An unchanged date that is already in
   * the past (normal for a live listing) is not an error; only a NEW date must be today or later.
   */
  keepAvailableFrom?: string;
}

/** Validates the fields owned by one step. Returns only the errors (empty object = valid). */
export function validateListingStep(step: number, f: ListingForm, ctx: ValidationContext): ListingErrors {
  const e: ListingErrors = {};
  const fields = WIZARD_STEPS.find((s) => s.id === step)?.fields ?? [];
  const has = (k: keyof ListingForm) => fields.includes(k);

  if (has("type") && !f.type) e.type = "Choose a property type.";
  if (has("title")) {
    const n = f.title.trim().length;
    if (n < 10 || n > 80) e.title = "Enter a title of 10–80 characters.";
  }
  if (has("description")) {
    const d = f.description.trim();
    if (d.length < 40 || d.length > 1000) e.description = "Enter a description of 40–1000 characters.";
    else if (CONTACT_PATTERN.test(d) || digits(d).length >= 10) e.description = "Please don't include phone numbers or emails in the description.";
  }

  if (has("locality") && !LOCALITIES.some((l) => l.id === f.locality)) e.locality = "Choose a Jaipur locality.";
  if (has("addressArea")) {
    const n = f.addressArea.trim().length;
    if (n < 5 || n > 100) e.addressArea = "Enter an address area of 5–100 characters.";
  }
  if (has("landmark") && f.landmark.trim().length > 80) e.landmark = "Landmark must be 80 characters or fewer.";

  const rent = intOrNull(f.rent);
  if (has("rent") && (rent === null || rent < MIN_RENT || rent > MAX_RENT_LISTING)) {
    e.rent = `Enter a monthly rent between ${formatRupees(MIN_RENT)} and ${formatRupees(MAX_RENT_LISTING)}.`;
  }
  if (has("deposit")) {
    const dep = intOrNull(f.deposit);
    if (dep === null || (rent !== null && dep > rent * 12)) e.deposit = "Enter a deposit between ₹0 and 12 times the rent.";
  }
  if (has("maintenanceCharge") && !f.maintenanceIncluded && f.maintenanceCharge.trim() !== "" && intOrNull(f.maintenanceCharge) === null) {
    e.maintenanceCharge = "Enter a valid maintenance charge (₹0 or more).";
  }
  if (has("availableFrom")) {
    const min = toISODate(startOfDay(ctx.today));
    const max = toISODate(addDays(startOfDay(ctx.today), 180));
    const unchanged = ctx.keepAvailableFrom !== undefined && f.availableFrom === ctx.keepAvailableFrom;
    if (!unchanged && (!/^\d{4}-\d{2}-\d{2}$/.test(f.availableFrom) || f.availableFrom < min || f.availableFrom > max)) {
      e.availableFrom = "Choose a date from today up to 180 days ahead.";
    }
  }

  if (has("bedrooms")) {
    const b = intOrNull(f.bedrooms);
    if (b === null || b < 1 || b > 6) e.bedrooms = "Choose 1 to 6 rooms.";
  }
  if (has("bathrooms")) {
    const b = intOrNull(f.bathrooms);
    if (b === null || b < 1 || b > 6) e.bathrooms = "Choose 1 to 6 bathrooms.";
  }
  if (has("furnishing") && !f.furnishing) e.furnishing = "Choose a furnishing status.";
  if (has("sizeSqft") && f.sizeSqft.trim() !== "") {
    const s = intOrNull(f.sizeSqft);
    if (s === null || s < 100 || s > 10_000) e.sizeSqft = "Size must be between 100 and 10,000 sq ft.";
  }

  if (has("photoIds") && (f.photoIds.length < 1 || f.photoIds.length > MAX_PHOTOS)) e.photoIds = `Choose at least one photo (up to ${MAX_PHOTOS}).`;

  if (ctx.needContact && has("contactName") && !normalizeName(f.contactName)) e.contactName = NAME_ERROR;
  if (ctx.needContact && has("contactPhone") && !normalizePhone(f.contactPhone)) e.contactPhone = PHONE_ERROR;
  if (has("acknowledged") && !f.acknowledged) e.acknowledged = "Please confirm you understand this is a demo listing.";
  return e;
}

function normalizeName(n: string): boolean {
  const t = n.trim();
  return t.length >= 2 && t.length <= 60 && /^\p{L}[\p{L} .'-]*$/u.test(t);
}

/** Validates every step; returns the first failing step (or null) and all errors. */
export function validateListing(f: ListingForm, ctx: ValidationContext, steps: readonly number[] = WIZARD_STEPS.map((s) => s.id)): { firstInvalidStep: number | null; errors: ListingErrors } {
  let first: number | null = null;
  const errors: ListingErrors = {};
  for (const s of steps) {
    const e = validateListingStep(s, f, ctx);
    if (Object.keys(e).length > 0) {
      Object.assign(errors, e);
      if (first === null) first = s;
    }
  }
  return { firstInvalidStep: first, errors };
}

export interface ListingValues {
  type: PropertyType;
  title: string;
  description: string;
  locality: LocalityId;
  addressArea: string;
  landmark: string | null;
  rent: number;
  deposit: number;
  maintenanceCharge: number | null;
  maintenanceIncluded: boolean;
  availableFrom: string;
  bedrooms: number;
  bathrooms: number;
  furnishing: Furnishing;
  sizeSqft: number | null;
  amenities: AmenityId[];
  photoIds: string[];
}

/** Typed values from a form that already passed validation. */
export function parseListing(f: ListingForm): ListingValues {
  return {
    type: f.type as PropertyType,
    title: f.title.trim(),
    description: f.description.trim(),
    locality: f.locality as LocalityId,
    addressArea: f.addressArea.trim(),
    landmark: f.landmark.trim() === "" ? null : f.landmark.trim(),
    rent: parseInt(f.rent, 10),
    deposit: parseInt(f.deposit, 10),
    maintenanceCharge: f.maintenanceIncluded || f.maintenanceCharge.trim() === "" ? null : parseInt(f.maintenanceCharge, 10),
    maintenanceIncluded: f.maintenanceIncluded || f.maintenanceCharge.trim() === "",
    availableFrom: f.availableFrom,
    bedrooms: parseInt(f.bedrooms, 10),
    bathrooms: parseInt(f.bathrooms, 10),
    furnishing: f.furnishing as Furnishing,
    sizeSqft: f.sizeSqft.trim() === "" ? null : parseInt(f.sizeSqft, 10),
    amenities: AMENITY_IDS.filter((a) => f.amenities.includes(a)),
    photoIds: [...f.photoIds],
  };
}

/** Form values for editing an existing property. */
export function propertyToForm(p: Property): ListingForm {
  return {
    ...EMPTY_LISTING,
    type: p.type,
    title: p.title,
    description: p.description,
    locality: p.locality,
    addressArea: p.addressArea,
    landmark: p.landmark ?? "",
    rent: String(p.rent),
    deposit: String(p.deposit),
    maintenanceCharge: p.maintenanceCharge === null ? "" : String(p.maintenanceCharge),
    maintenanceIncluded: p.maintenanceIncluded,
    availableFrom: p.availableFrom,
    bedrooms: String(p.bedrooms),
    bathrooms: String(p.bathrooms),
    furnishing: p.furnishing,
    sizeSqft: p.sizeSqft === null ? "" : String(p.sizeSqft),
    amenities: [...p.amenities],
    photoIds: [...p.photoIds],
  };
}

/** Fields whose change on a published listing invalidates an earlier "listing accuracy" check (D-16). */
export const ACCURACY_FIELDS = ["photoIds", "rent", "bedrooms", "bathrooms", "furnishing", "sizeSqft", "type"] as const;
