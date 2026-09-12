import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Set RLS context for the current request.
   * MUST be called inside a transaction or before any query.
   */
  async setRlsContext(params: {
    userId: string;
    orgIds: string[];
    isPlatformAdmin?: boolean;
    isOrgAdmin?: boolean;
  }) {
    const orgIdsStr = params.orgIds.join(',');
    await this.$executeRawUnsafe(
      `SELECT set_config('app.current_user_id', $1, true)`,
      params.userId,
    );
    await this.$executeRawUnsafe(
      `SELECT set_config('app.current_org_ids', $1, true)`,
      orgIdsStr,
    );
    await this.$executeRawUnsafe(
      `SELECT set_config('app.is_platform_admin', $1, true)`,
      params.isPlatformAdmin ? 'true' : 'false',
    );
    await this.$executeRawUnsafe(
      `SELECT set_config('app.is_org_admin', $1, true)`,
      params.isOrgAdmin ? 'true' : 'false',
    );
  }

  /**
   * Run a function inside a transaction with RLS context applied.
   */
  async withRls<T>(
    context: {
      userId: string;
      orgIds: string[];
      isPlatformAdmin?: boolean;
      isOrgAdmin?: boolean;
    },
    fn: (tx: PrismaClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      // Apply RLS settings inside the transaction
      const orgIdsStr = context.orgIds.join(',');
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.current_user_id', $1, true)`,
        context.userId,
      );
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.current_org_ids', $1, true)`,
        orgIdsStr,
      );
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.is_platform_admin', $1, true)`,
        context.isPlatformAdmin ? 'true' : 'false',
      );
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.is_org_admin', $1, true)`,
        context.isOrgAdmin ? 'true' : 'false',
      );

      return fn(tx as unknown as PrismaClient);
    });
  }
}
