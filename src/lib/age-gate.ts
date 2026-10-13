"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { AGE_COOKIE } from "./age-cookie";

/** Bestätigung „18 oder älter“, 30 Tage gültig. Nur ein Cookie, keine weiteren Daten. */
export async function confirmAge(formData: FormData) {
  if (formData.get("bestaetigung") !== "ja") return;
  (await cookies()).set(AGE_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  revalidatePath("/", "layout");
}
