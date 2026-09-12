import { Module } from '@nestjs/common';
import { SheetsGateway } from './sheets.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [SheetsGateway],
})
export class WebsocketModule {}
