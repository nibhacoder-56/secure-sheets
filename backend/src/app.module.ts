import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { WorkbooksModule } from './workbooks/workbooks.module';
import { PermissionsModule } from './permissions/permissions.module';
import { AuditModule } from './audit/audit.module';
import { WebsocketModule } from './websocket/websocket.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    WorkbooksModule,
    PermissionsModule,
    AuditModule,
    WebsocketModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
