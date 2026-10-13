import "server-only";
import { cookies } from "next/headers";
import { AGE_COOKIE } from "./age-cookie";

export async function isAgeConfirmed(): Promise<boolean> {
  return (await cookies()).get(AGE_COOKIE)?.value === "1";
}
