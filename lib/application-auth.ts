import { getChatGPTUser, type ChatGPTUser } from "@/app/chatgpt-auth";
import { authMode, readPasswordSession } from "./password-auth.ts";

export type ApplicationUser = ChatGPTUser & { method?: "sites" | "password"; profileId?: string; mustChangePassword?: boolean };
export async function getApplicationUser(): Promise<ApplicationUser | null> {
  if (authMode() === "sites") return getChatGPTUser();
  // Independent hosting never accepts caller-supplied Sites identity headers.
  const session = await readPasswordSession();
  if (!session) return null;
  return { userId: session.auth_id || `password:${session.provider_id}`, profileId: session.id, method: "password", mustChangePassword: Boolean(session.must_change_password),
    displayName: session.full_name, fullName: session.full_name, email: session.email };
}
