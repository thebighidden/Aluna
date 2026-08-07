export interface WaitlistTemplate {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  /** {{name}}, {{offerCode}} and {{link}} are substituted before the link is built. */
  readonly body: string;
}

export const WAITLIST_TEMPLATES: readonly WaitlistTemplate[] = [
  {
    id: 'launch_invite',
    label: 'Launch invite',
    description: 'Tells a subscriber their free week is live and gives them the offer code.',
    body: `Hi! It's the Aluna Studio team.

Your spot is ready — you can now turn one product photo into a full campaign in a couple of minutes.

Your offer code: {{offerCode}}
Start here: {{link}}

Reply here if you'd like us to set up your first campaign with you.`,
  },
  {
    id: 'early_access',
    label: 'Early access check-in',
    description: 'Softer touch for subscribers who have not signed up yet.',
    body: `Hi! Aluna Studio here.

You joined our waiting list a little while back, so we wanted to check whether you'd still like early access.

If yes, just reply and we'll open your account with the {{offerCode}} offer attached.`,
  },
  {
    id: 'ask_product',
    label: 'Ask for a product photo',
    description: 'Invites the subscriber to send one photo so you can demo a result.',
    body: `Hi! Aluna Studio here.

Would you like to see what we can do with your product? Send us one clear photo of a single item and we'll send back a campaign image for it, free.

No commitment — we just want you to see the quality first.`,
  },
] as const;

export function findWaitlistTemplate(id: string): WaitlistTemplate | undefined {
  return WAITLIST_TEMPLATES.find((template) => template.id === id);
}

export function renderWaitlistTemplate(
  template: WaitlistTemplate,
  values: { offerCode: string; link: string },
): string {
  return template.body
    .replaceAll('{{offerCode}}', values.offerCode)
    .replaceAll('{{link}}', values.link);
}

/**
 * Builds a wa.me deep link. The number must be digits only with country code and no leading "+",
 * which is what WhatsApp expects; anything else silently opens an empty chat.
 */
export function whatsappLink(phone: string, body: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
}
