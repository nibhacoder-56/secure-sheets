import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '@nestjs/common';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  orgIds?: string[];
  isPlatformAdmin?: boolean;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/sheets',
})
export class SheetsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SheetsGateway.name);

  // sheetId -> Set of socket ids
  private sheetRooms = new Map<string, Set<string>>();

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwt.verify(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          isActive: true,
          globalRole: true,
          memberships: { select: { organizationId: true } },
        },
      });

      if (!user || !user.isActive) {
        client.disconnect();
        return;
      }

      client.userId = user.id;
      client.orgIds = user.memberships.map((m) => m.organizationId);
      client.isPlatformAdmin = user.globalRole === 'PLATFORM_SUPER_ADMIN';

      this.logger.log(`Client connected: ${client.id} (user ${user.id})`);
    } catch (err) {
      this.logger.warn(`Connection rejected: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    // Leave all rooms
    for (const [sheetId, sockets] of this.sheetRooms.entries()) {
      if (sockets.has(client.id)) {
        sockets.delete(client.id);
        client.to(`sheet:${sheetId}`).emit('presence:leave', {
          socketId: client.id,
          userId: client.userId,
        });
        if (sockets.size === 0) this.sheetRooms.delete(sheetId);
      }
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Join a sheet room for real-time collaboration.
   * Permission is checked before joining.
   */
  @SubscribeMessage('sheet:join')
  async handleJoinSheet(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { sheetId: string },
  ) {
    if (!client.userId || !data.sheetId) return { error: 'Unauthorized' };

    const sheet = await this.prisma.sheet.findUnique({
      where: { id: data.sheetId },
      select: {
        id: true,
        organizationId: true,
        name: true,
        permissions: {
          where: { userId: client.userId },
          select: { permission: true, expiresAt: true },
        },
      },
    });

    if (!sheet) return { error: 'Sheet not found' };

    // Check access
    const hasOrgAccess =
      client.isPlatformAdmin ||
      client.orgIds?.includes(sheet.organizationId);

    const sheetPerm = sheet.permissions[0];
    const hasValidSheetPerm =
      sheetPerm &&
      (!sheetPerm.expiresAt || sheetPerm.expiresAt > new Date());

    // Also check workbook-level permission (simplified)
    const workbookPerm = await this.prisma.workbookPermission.findFirst({
      where: {
        workbook: { sheets: { some: { id: data.sheetId } } },
        userId: client.userId,
      },
    });

    if (!hasOrgAccess && !hasValidSheetPerm && !workbookPerm) {
      return { error: 'No permission to access this sheet' };
    }

    const room = `sheet:${data.sheetId}`;
    client.join(room);

    if (!this.sheetRooms.has(data.sheetId)) {
      this.sheetRooms.set(data.sheetId, new Set());
    }
    this.sheetRooms.get(data.sheetId)!.add(client.id);

    // Notify others
    client.to(room).emit('presence:join', {
      socketId: client.id,
      userId: client.userId,
    });

    // Return current presence
    const presence = Array.from(this.sheetRooms.get(data.sheetId) || []);

    return {
      success: true,
      sheetId: data.sheetId,
      presenceCount: presence.length,
    };
  }

  @SubscribeMessage('sheet:leave')
  handleLeaveSheet(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { sheetId: string },
  ) {
    const room = `sheet:${data.sheetId}`;
    client.leave(room);

    const sockets = this.sheetRooms.get(data.sheetId);
    if (sockets) {
      sockets.delete(client.id);
      if (sockets.size === 0) this.sheetRooms.delete(data.sheetId);
    }

    client.to(room).emit('presence:leave', {
      socketId: client.id,
      userId: client.userId,
    });

    return { success: true };
  }

  /**
   * Broadcast Yjs update to other clients in the same sheet.
   * In production you would also persist the update.
   */
  @SubscribeMessage('yjs:update')
  handleYjsUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { sheetId: string; update: any },
  ) {
    if (!client.userId || !data.sheetId) return;

    // Broadcast to everyone else in the room
    client.to(`sheet:${data.sheetId}`).emit('yjs:update', {
      sheetId: data.sheetId,
      update: data.update,
      from: client.userId,
    });
  }

  /**
   * Cursor / presence update
   */
  @SubscribeMessage('presence:cursor')
  handleCursor(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { sheetId: string; cellRef?: string; name?: string },
  ) {
    if (!client.userId || !data.sheetId) return;

    client.to(`sheet:${data.sheetId}`).emit('presence:cursor', {
      socketId: client.id,
      userId: client.userId,
      cellRef: data.cellRef,
      name: data.name,
    });
  }

  /**
   * Force disconnect a user from a sheet (used when permission is revoked)
   */
  forceLeaveSheet(userId: string, sheetId: string) {
    const room = `sheet:${sheetId}`;
    const sockets = this.sheetRooms.get(sheetId);
    if (!sockets) return;

    for (const socketId of sockets) {
      const socket = this.server.sockets.sockets.get(socketId) as AuthenticatedSocket;
      if (socket?.userId === userId) {
        socket.leave(room);
        socket.emit('sheet:force-leave', { sheetId, reason: 'permission_revoked' });
        sockets.delete(socketId);
      }
    }
  }
}
