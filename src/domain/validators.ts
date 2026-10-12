import { z } from "zod";
import { addDays, startOfDay, toISODate } from "./dates";

/**
 * Shared validators (blueprint §6.6, §7.4). Used by forms and — in later phases — by store
 * mutations so UI bugs cannot create invalid records.
 */

/** Returns the 10-digit Indian mobile number, or `null` if the input is not valid. */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/[\s\-()]/g, "");
  if (digits.startsWith("+91")) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export const NAME_ERROR = "Enter your full name (2–60 letters).";
export const PHONE_ERROR = "Enter a valid 10-digit Indian mobile number.";
export const DATE_ERROR = "Choose a date within the next 30 days.";
export const SLOT_ERROR = "Choose a time slot.";
export const MESSAGE_ERROR = "Message is too long (max 300).";

export const nameSchema = z
  .string()
  .trim()
  .min(2, NAME_ERROR)
  .max(60, NAME_ERROR)
  .regex(/^\p{L}[\p{L} .'-]*$/u, NAME_ERROR);

export const phoneSchema = z
  .string()
  .transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: PHONE_ERROR });
      return z.NEVER;
    }
    return n;
  });

export const slotSchema = z.enum(["morning", "afternoon", "evening"], {
  errorMap: () => ({ message: SLOT_ERROR }),
});

export const messageSchema = z.string().max(300, MESSAGE_ERROR).optional();

/** Preferred visit date: today → +30 days, as `YYYY-MM-DD` (§6.6). */
export function visitDateSchema(today: Date) {
  const min = toISODate(startOfDay(today));
  const max = toISODate(addDays(startOfDay(today), 30));
  return z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, DATE_ERROR)
    .refine((d) => d >= min && d <= max, DATE_ERROR);
}

export function visitRequestInputSchema(today: Date) {
  return z.object({
    name: nameSchema,
    phone: phoneSchema,
    date: visitDateSchema(today),
    slot: slotSchema,
    message: messageSchema,
  });
}

export interface VisitFormValues {
  name: string;
  phone: string;
  date: string;
  slot: string;
  message: string;
}

export type VisitFieldKey = "name" | "phone" | "date" | "slot" | "message";
export type FieldErrors = Partial<Record<VisitFieldKey, string>>;

export interface ValidVisitInput {
  name: string;
  /** 10 digits */
  phone: string;
  date: string;
  slot: "morning" | "afternoon" | "evening";
  message: string | null;
}

/** Field order for focusing the first error (§6.6). */
export const VISIT_FIELD_ORDER: readonly VisitFieldKey[] = ["name", "phone", "date", "slot", "message"];

/** Validates the visit form with one message per field, using the exact copy from §6.6. */
export function validateVisitForm(v: VisitFormValues, today: Date): { ok: true; value: ValidVisitInput } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const name = nameSchema.safeParse(v.name);
  if (!name.success) errors.name = NAME_ERROR;
  const phone = phoneSchema.safeParse(v.phone);
  if (!phone.success) errors.phone = PHONE_ERROR;
  const date = visitDateSchema(today).safeParse(v.date);
  if (!date.success) errors.date = DATE_ERROR;
  const slot = slotSchema.safeParse(v.slot);
  if (!slot.success) errors.slot = SLOT_ERROR;
  const message = messageSchema.safeParse(v.message);
  if (!message.success) errors.message = MESSAGE_ERROR;
  if (Object.keys(errors).length > 0 || !name.success || !phone.success || !date.success || !slot.success) {
    return { ok: false, errors };
  }
  const trimmed = v.message.trim();
  return { ok: true, value: { name: name.data, phone: phone.data, date: date.data, slot: slot.data, message: trimmed === "" ? null : trimmed } };
}

/** Optional profile details: both may be empty; anything entered must be valid. */
export function validateProfile(v: { name: string; phone: string }): { ok: true; value: { name: string | null; phone: string | null } } | { ok: false; errors: Partial<Record<"name" | "phone", string>> } {
  const errors: Partial<Record<"name" | "phone", string>> = {};
  let name: string | null = null;
  let phone: string | null = null;
  if (v.name.trim() !== "") {
    const r = nameSchema.safeParse(v.name);
    if (r.success) name = r.data;
    else errors.name = NAME_ERROR;
  }
  if (v.phone.trim() !== "") {
    const r = phoneSchema.safeParse(v.phone);
    if (r.success) phone = r.data;
    else errors.phone = PHONE_ERROR;
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value: { name, phone } };
}
