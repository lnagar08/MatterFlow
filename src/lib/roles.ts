export const INVITE_ROLES = ["ATTORNEY", "STAFF", "READ_ONLY"] as const;

export type InviteRole = (typeof INVITE_ROLES)[number];

export function isInviteRole(input: string): input is InviteRole {
  return INVITE_ROLES.includes(input as InviteRole);
}

export function roleLabel(role: string) {
  switch (role) {
    case "ADMIN":
      return "Admin";
    case "ATTORNEY":
      return "Attorney";
    case "STAFF":
      return "Staff";
    case "READ_ONLY":
      return "Read Only";
    default:
      return role;
  }
}
