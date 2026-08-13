import "server-only";

const SIGNUP_INVITE_CODE = "moneycontext909";

export function isSignupInviteCodeValid(inviteCode: string): boolean {
  return inviteCode.trim() === SIGNUP_INVITE_CODE;
}
