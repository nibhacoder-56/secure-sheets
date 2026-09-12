import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    let dbStatus = 'unknown';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'ok';
    } catch (e) {
      dbStatus = 'error';
    }

    return {
      status: 'ok',
      service: 'secure-sheets-api',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      version: '0.1.0',
    };
  }
}
