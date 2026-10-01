/// <reference types="vite/client" />

declare module 'socket.io-client' {
  export function io(uri?: string, opts?: any): any;
  export type Socket = any;
}
