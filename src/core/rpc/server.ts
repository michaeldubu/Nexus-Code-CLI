/**
 * Nexus Code - JSON-RPC 2.0 Server
 * Production-ready RPC server with WebSocket support
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { WebSocket, WebSocketServer } from 'ws';
import express, { Express, Request, Response } from 'express';
import {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcErrorCode,
  Result,
  success,
  failure,
} from '../types/index.js';

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

export class JsonRpcError extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: any,
  ) {
    super(message);
    this.name = 'JsonRpcError';
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      data: this.data,
    };
  }
}

/**
 * Production-ready JSON-RPC 2.0 Server
 * Supports both HTTP and WebSocket transports
 */
export class JsonRpcServer extends EventEmitter {
  private handlers = new Map<string, RpcHandler>();
  private middleware: Array<(context: RpcContext) => Promise<void>> = [];
  private httpServer?: Express;
  private wsServer?: WebSocketServer;
  private config: RpcServerConfig;
  private activeSessions = new Map<string, WebSocket>();

  constructor(config: RpcServerConfig) {
    super();
    this.config = config;
  }

  /**
   * Register an RPC method handler
   */
  register(method: string, handler: RpcHandler): void {
    if (this.handlers.has(method)) {
      throw new Error(`Method '${method}' is already registered`);
    }
    this.handlers.set(method, handler);
    this.emit('method:registered', { method });
  }

  /**
   * Unregister an RPC method handler
   */
  unregister(method: string): boolean {
    const removed = this.handlers.delete(method);
    if (removed) {
      this.emit('method:unregistered', { method });
    }
    return removed;
  }

  /**
   * Add middleware to process requests
   */
  use(middleware: (context: RpcContext) => Promise<void>): void {
    this.middleware.push(middleware);
  }

  /**
   * Start the RPC server
   */
  async start(): Promise<void> {
    if (this.config.enableHttp) {
      await this.startHttpServer();
    }

    if (this.config.enableWebSocket) {
      await this.startWebSocketServer();
    }

    this.emit('server:started', { config: this.config });
  }

  /**
   * Stop the RPC server
   */
  async stop(): Promise<void> {
    // Close all WebSocket connections
    for (const [sessionId, ws] of this.activeSessions) {
      ws.close();
    }
    this.activeSessions.clear();

    // Close servers
    if (this.wsServer) {
      this.wsServer.close();
    }

    this.emit('server:stopped');
  }

  /**
   * Send a notification to a specific session
   */
  notify(sessionId: string, method: string, params: any): void {
    const ws = this.activeSessions.get(sessionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      const notification: JsonRpcRequest = {
        jsonrpc: '2.0',
        method,
        params,
      };
      ws.send(JSON.stringify(notification));
    }
  }

  /**
   * Broadcast a notification to all sessions
   */
  broadcast(method: string, params: any): void {
    const notification: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
    };
    const message = JSON.stringify(notification);

    for (const ws of this.activeSessions.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }

  /**
   * Process an RPC request
   */
  private async processRequest(
    request: JsonRpcRequest,
    context: RpcContext,
  ): Promise<JsonRpcResponse> {
    try {
      // Validate request format
      if (request.jsonrpc !== '2.0') {
        throw new JsonRpcError(
          JsonRpcErrorCode.INVALID_REQUEST,
          'Invalid JSON-RPC version',
        );
      }

      if (!request.method) {
        throw new JsonRpcError(
          JsonRpcErrorCode.INVALID_REQUEST,
          'Missing method',
        );
      }

      // Run middleware
      for (const mw of this.middleware) {
        await mw(context);
      }

      // Get handler
      const handler = this.handlers.get(request.method);
      if (!handler) {
        throw new JsonRpcError(
          JsonRpcErrorCode.METHOD_NOT_FOUND,
          `Method '${request.method}' not found`,
        );
      }

      // Execute handler
      const result = await handler(request.params, context);

      // Return success response
      return {
        jsonrpc: '2.0',
        result,
        id: request.id ?? null,
      };
    } catch (error) {
      // Handle errors
      if (error instanceof JsonRpcError) {
        return {
          jsonrpc: '2.0',
          error: error.toJSON(),
          id: request.id ?? null,
        };
      }

      return {
        jsonrpc: '2.0',
        error: {
          code: JsonRpcErrorCode.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Internal error',
          data: error instanceof Error ? error.stack : undefined,
        },
        id: request.id ?? null,
      };
    }
  }

  /**
   * Start HTTP server
   */
  private async startHttpServer(): Promise<void> {
    this.httpServer = express();

    // Middleware
    this.httpServer.use(express.json({ limit: this.config.maxPayloadSize }));

    if (this.config.cors) {
      this.httpServer.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') {
          return res.sendStatus(200);
        }
        next();
      });
    }

    // RPC endpoint
    this.httpServer.post('/rpc', async (req: Request, res: Response) => {
      try {
        const context: RpcContext = {
          requestId: req.body.id ?? null,
          sessionId: req.headers['x-session-id'] as string || uuidv4(),
          userId: req.headers['x-user-id'] as string || 'anonymous',
          metadata: {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          },
        };

        const response = await this.processRequest(req.body, context);
        res.json(response);
      } catch (error) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: JsonRpcErrorCode.PARSE_ERROR,
            message: 'Parse error',
          },
          id: null,
        });
      }
    });

    // Health check endpoint
    this.httpServer.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        methods: Array.from(this.handlers.keys()),
        activeSessions: this.activeSessions.size,
      });
    });

    return new Promise((resolve) => {
      this.httpServer!.listen(this.config.port, () => {
        this.emit('http:started', { port: this.config.port });
        resolve();
      });
    });
  }

  /**
   * Start WebSocket server
   */
  private async startWebSocketServer(): Promise<void> {
    this.wsServer = new WebSocketServer({ port: this.config.port + 1 });

    this.wsServer.on('connection', (ws: WebSocket, req) => {
      const sessionId = uuidv4();
      this.activeSessions.set(sessionId, ws);

      this.emit('ws:connection', { sessionId });

      ws.on('message', async (data: Buffer) => {
        try {
          const request: JsonRpcRequest = JSON.parse(data.toString());
          
          const context: RpcContext = {
            requestId: request.id ?? null,
            sessionId,
            userId: req.headers['x-user-id'] as string || 'anonymous',
            metadata: {
              ip: req.socket.remoteAddress,
            },
          };

          const response = await this.processRequest(request, context);
          
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(response));
          }
        } catch (error) {
          const errorResponse: JsonRpcResponse = {
            jsonrpc: '2.0',
            error: {
              code: JsonRpcErrorCode.PARSE_ERROR,
              message: 'Parse error',
            },
            id: null,
          };
          
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(errorResponse));
          }
        }
      });

      ws.on('close', () => {
        this.activeSessions.delete(sessionId);
        this.emit('ws:disconnection', { sessionId });
      });

      ws.on('error', (error) => {
        this.emit('ws:error', { sessionId, error });
        this.activeSessions.delete(sessionId);
      });
    });

    this.emit('ws:started', { port: this.config.port + 1 });
  }
}

/**
 * JSON-RPC 2.0 Client
 */
export class JsonRpcClient {
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (result: any) => void;
    reject: (error: any) => void;
  }>();

  constructor(
    private ws: WebSocket,
  ) {
    this.ws.on('message', (data: Buffer) => {
      try {
        const response: JsonRpcResponse = JSON.parse(data.toString());
        
        if (typeof response.id === 'number') {
          const pending = this.pendingRequests.get(response.id);
          if (pending) {
            if (response.error) {
              pending.reject(new JsonRpcError(
                response.error.code,
                response.error.message,
                response.error.data,
              ));
            } else {
              pending.resolve(response.result);
            }
            this.pendingRequests.delete(response.id);
          }
        }
      } catch (error) {
        console.error('Failed to parse RPC response:', error);
      }
    });
  }

  /**
   * Call an RPC method
   */
  async call(method: string, params?: any): Promise<any> {
    const id = ++this.requestId;
    
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(request));

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Send a notification (no response expected)
   */
  notify(method: string, params?: any): void {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
    };
    this.ws.send(JSON.stringify(request));
  }

  /**
   * Close the client connection
   */
  close(): void {
    this.ws.close();
  }
}
