import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  id: string;
  email?: string | null;
  phone?: string | null;
  globalRole: string;
  orgIds: string[];
  /** organizationId -> role (ORG_ADMIN | HR | MEMBER) */
  orgRoles: Record<string, string>;
  isPlatformAdmin: boolean;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser | any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthUser;
    return data ? user?.[data] : user;
  },
);

/** Helper: is user HR or Org Admin for this org? */
export function isHrOrAdmin(user: AuthUser, orgId: string): boolean {
  if (user.isPlatformAdmin) return true;
  const role = user.orgRoles[orgId];
  return role === 'HR' || role === 'ORG_ADMIN';
}
