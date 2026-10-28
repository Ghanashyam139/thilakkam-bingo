import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  if (typeof window !== 'undefined') {
    if (!socket) {
      // Connect to the same origin server hosting both Next.js and Socket.io
      socket = io({
        autoConnect: false, // Let components connect explicitly when they are ready
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });
    }
    return socket;
  }
  return null;
}
