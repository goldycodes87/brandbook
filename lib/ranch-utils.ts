export function getOwnerLabel(
  owner: { owner_name?: string | null; company_name?: string | null } | null,
  ranchName: string
): string {
  if (!owner) return ranchName
  return owner.company_name || owner.owner_name || ranchName
}
