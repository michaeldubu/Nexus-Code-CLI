/**
 * Nexus Code - JSON-RPC 2.0 Server
 * Production-ready RPC server with WebSocket support
 */
import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
export type RpcHandler = (params: any, context: RpcContext) => Promise<any>;
export interface RpcContext {
    requestId: string | number | null;
    sessionId: string;
    userId: string;
    metadata: Record<string, any>;
}
export interface RpcServerConfig {
    port: number;
    enableWebSocket: boolean;
    enableHttp: boolean;
    cors: boolean;
    maxPayloadSize: string;
}
export declare class JsonRpcError extends Error {
    code: number;
    data?: any | undefined;
    constructor(code: number, message: string, data?: any | undefined);
    toJSON(): {
        code: number;
        message: string;
        data: any;
    };
}
/**
 * Production-ready JSON-RPC 2.0 Server
 * Supports both HTTP and WebSocket transports
 */
export declare class JsonRpcServer extends EventEmitter {
    private handlers;
    private middleware;
    private httpServer?;
    private wsServer?;
    private config;
    private activeSessions;
    constructor(config: RpcServerConfig);
    /**
     * Register an RPC method handler
     */
    register(method: string, handler: RpcHandler): void;
    /**
     * Unregister an RPC method handler
     */
    unregister(method: string): boolean;
    /**
     * Add middleware to process requests
     */
    use(middleware: (context: RpcContext) => Promise<void>): void;
    /**
     * Start the RPC server
     */
    start(): Promise<void>;
    /**
     * Stop the RPC server
     */
    stop(): Promise<void>;
    /**
     * Send a notification to a specific session
     */
    notify(sessionId: string, method: string, params: any): void;
    /**
     * Broadcast a notification to all sessions
     */
    broadcast(method: string, params: any): void;
    /**
     * Process an RPC request
     */
    private processRequest;
    /**
     * Start HTTP server
     */
    private startHttpServer;
    /**
     * Start WebSocket server
     */
    private startWebSocketServer;
}
/**
 * JSON-RPC 2.0 Client
 */
export declare class JsonRpcClient {
    private ws;
    private requestId;
    private pendingRequests;
    constructor(ws: WebSocket);
    /**
     * Call an RPC method
     */
    call(method: string, params?: any): Promise<any>;
    /**
     * Send a notification (no response expected)
     */
    notify(method: string, params?: any): void;
    /**
     * Close the client connection
     */
    close(): void;
}
//# sourceMappingURL=server.d.ts.map