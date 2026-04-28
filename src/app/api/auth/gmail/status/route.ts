import { isGmailConfigured, getConnectedAccount } from "@/lib/gmail";

export async function GET() {
  const configured = isGmailConfigured();
  const account = configured ? await getConnectedAccount() : null;
  return Response.json({
    configured,
    connected: Boolean(account),
    email: account?.email ?? null,
    expiryDate: account?.expiryDate ?? null,
  });
}
