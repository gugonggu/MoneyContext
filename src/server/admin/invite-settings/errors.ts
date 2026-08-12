export class NoInviteCodeError extends Error {
  constructor() {
    super("No invite code has been generated yet. Rotate the invite code first.");
    this.name = "NoInviteCodeError";
  }
}
