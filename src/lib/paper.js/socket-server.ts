// lib/socket-server.ts
import { Server as IOServer } from 'socket.io';
import type { Server as HTTPServer } from 'node:http';
import type { TextUpdateData, SocketAckResponse, TitleUpdateData, DrawingData, CursorPositionData } from './types';
import { PrismaDocumentService } from '../services/PrismaDocumentService';
import { recordDocumentHistory } from '../documentHistory';

let io: IOServer | null = null;
let documentServicePromise: Promise<PrismaDocumentService> | null = null;

async function getDocumentServiceInstance() {
  documentServicePromise ??= (async () => {
      const service = new PrismaDocumentService();
      if (process.env.DATABASE_URL) {
        try {
          await service.initializeTables();
        } catch (error) {
          console.error("❌ Unable to initialize Prisma tables (websocket):", error);
        }
      }
      return service;
    })();
  return documentServicePromise;
}

async function persistTextUpdate(data: TextUpdateData): Promise<boolean> {
  // If no snapshot, we cannot persist - but it's not an error if it's just a broadcast update
  if (!data.persistSnapshot) {
    return true; // No error, just no persistence needed
  }
  
  if (
    !process.env.DATABASE_URL ||
    !data.documentId ||
    typeof data.userId !== 'number' ||
    !data.userEmail
  ) {
    return true; // No error if conditions are not met (no DB configured)
  }

  try {
    const service = await getDocumentServiceInstance();
    const documentId = Number(data.documentId);

    // Retrieve previous snapshot to calculate diff
    let previousContent: string | null = null;
    try {
      const existing = await service.getDocumentById(documentId);
      if (existing.success && existing.document) {
        previousContent = existing.document.content;
      }
    } catch {
      // If document is not found, consider it as a first version
      previousContent = null;
    }

    const nextContent = JSON.stringify(data.persistSnapshot);

    // Record history before persisting new content
    await recordDocumentHistory({
      documentId,
      userId: data.userId,
      userEmail: data.userEmail,
      previousContent,
      nextContent,
    });

    await service.createOrUpdateDocumentById(
      documentId,
      data.userId,
      data.userEmail,
      data.title || '',
      nextContent,
      Array.isArray(data.tags) ? data.tags : []
    );
    
    return true; // Persistence successful
  } catch (error) {
    console.error("❌ Error while saving document via websocket:", error);
    throw error;
  }
}

export function initializeSocketServer(httpServer: HTTPServer) {
  if (io) {
    return io;
  }

    io = new IOServer(httpServer, {
      path: '/api/socket',
      cors: {
        origin: process.env.NEXT_PUBLIC_SOCKET_CORS_ORIGIN || '*',
        credentials: true,
      },
    });

  io.on('connection', (socket) => {
    // Store clientId associated with this socket for each room
    const clientIdByRoom = new Map<string, string>();

    socket.on('join-room', (roomId: string, clientId?: string) => {
      socket.join(roomId);
      if (clientId) {
        clientIdByRoom.set(roomId, clientId);
      }
      socket.to(roomId).emit('user-joined', clientId || socket.id);
    });

    socket.on('leave-room', (roomId: string, clientId?: string) => {
      socket.leave(roomId);
      // Use clientId if provided, otherwise use the stored one, otherwise socket.id
      const idToEmit = clientId || clientIdByRoom.get(roomId) || socket.id;
      socket.to(roomId).emit('user-left', idToEmit);
      clientIdByRoom.delete(roomId);
    });

    // When socket disconnects, notify all rooms it left
    socket.on('disconnect', () => {
      for (const [roomId, clientId] of clientIdByRoom.entries()) {
        socket.to(roomId).emit('user-left', clientId);
      }
      clientIdByRoom.clear();
    });

    socket.on('text-update', async (roomId: string, data: TextUpdateData, ack?: (response: SocketAckResponse) => void) => {
      try {
        // 1. Broadcast immediately to other clients
        socket.to(roomId).emit('text-update', data);
        
        // 2. Start persistence in background (non-blocking)
        persistTextUpdate(data).catch((error) => {
          console.error("❌ Persistence error (non-blocking):", error);
        });
        
        // 3. Respond immediately with success
        ack?.({ ok: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        ack?.({ ok: false, error: message });
      }
    });

    socket.on('text-update-with-cursor', async (roomId: string, data: TextUpdateData, ack?: (response: SocketAckResponse) => void) => {
      try {
        // 1. Broadcast immediately to other clients
        socket.to(roomId).emit('text-update', data);
        if (data.cursor) {
          socket.to(roomId).emit('cursor-position', data.cursor);
        }
        
        // 2. Start persistence in background (non-blocking)
        persistTextUpdate(data).catch((error) => {
          console.error("❌ Persistence error (non-blocking):", error);
        });
        
        // 3. Respond immediately with success
        ack?.({ ok: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        ack?.({ ok: false, error: message });
      }
    });

    socket.on('title-update', (roomId: string, data: TitleUpdateData & { clientId: string; ts: number }) => {
      socket.to(roomId).emit('title-update', data);
    });

    socket.on('drawing-data', (roomId: string, data: DrawingData) => {
      socket.to(roomId).emit('drawing-data', data);
    });

    socket.on('cursor-position', (roomId: string, data: CursorPositionData) => {
      socket.to(roomId).emit('cursor-position', data);
    });
  });

  return io;
}

export function getSocketServer() {
  return io;
}

