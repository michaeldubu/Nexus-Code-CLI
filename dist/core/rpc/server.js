/**
 * Nexus Code - JSON-RPC 2.0 Server
 * Production-ready RPC server with WebSocket support
 */
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { WebSocket, WebSocketServer } from 'ws';
import express from 'express';
import { JsonRpcErrorCode, } from '../types/index.js';
export class JsonRpcError extends Error {
    code;
    data;
    constructor(code, message, data) {
        super(message);
        this.code = code;
        this.data = data;
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
    handlers = new Map();
    middleware = [];
    httpServer;
    wsServer;
    config;
    activeSessions = new Map();
    constructor(config) {
        super();
        this.config = config;
    }
    /**
     * Register an RPC method handler
     */
    register(method, handler) {
        if (this.handlers.has(method)) {
            throw new Error(`Method '${method}' is already registered`);
        }
        this.handlers.set(method, handler);
        this.emit('method:registered', { method });
    }
    /**
     * Unregister an RPC method handler
     */
    unregister(method) {
        const removed = this.handlers.delete(method);
        if (removed) {
            this.emit('method:unregistered', { method });
        }
        return removed;
    }
    /**
     * Add middleware to process requests
     */
    use(middleware) {
        this.middleware.push(middleware);
    }
    /**
     * Start the RPC server
     */
    async start() {
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
    async stop() {
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
    notify(sessionId, method, params) {
        const ws = this.activeSessions.get(sessionId);
        if (ws && ws.readyState === WebSocket.OPEN) {
            const notification = {
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
    broadcast(method, params) {
        const notification = {
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
    async processRequest(request, context) {
        try {
            // Validate request format
            if (request.jsonrpc !== '2.0') {
                throw new JsonRpcError(JsonRpcErrorCode.INVALID_REQUEST, 'Invalid JSON-RPC version');
            }
            if (!request.method) {
                throw new JsonRpcError(JsonRpcErrorCode.INVALID_REQUEST, 'Missing method');
            }
            // Run middleware
            for (const mw of this.middleware) {
                await mw(context);
            }
            // Get handler
            const handler = this.handlers.get(request.method);
            if (!handler) {
                throw new JsonRpcError(JsonRpcErrorCode.METHOD_NOT_FOUND, `Method '${request.method}' not found`);
            }
            // Execute handler
            const result = await handler(request.params, context);
            // Return success response
            return {
                jsonrpc: '2.0',
                result,
                id: request.id ?? null,
            };
        }
        catch (error) {
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
    async startHttpServer() {
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
        this.httpServer.post('/rpc', async (req, res) => {
            try {
                const context = {
                    requestId: req.body.id ?? null,
                    sessionId: req.headers['x-session-id'] || uuidv4(),
                    userId: req.headers['x-user-id'] || 'anonymous',
                    metadata: {
                        ip: req.ip,
                        userAgent: req.headers['user-agent'],
                    },
                };
                const response = await this.processRequest(req.body, context);
                res.json(response);
            }
            catch (error) {
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
        this.httpServer.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                methods: Array.from(this.handlers.keys()),
                activeSessions: this.activeSessions.size,
            });
        });
        return new Promise((resolve) => {
            this.httpServer.listen(this.config.port, () => {
                this.emit('http:started', { port: this.config.port });
                resolve();
            });
        });
    }
    /**
     * Start WebSocket server
     */
    async startWebSocketServer() {
        this.wsServer = new WebSocketServer({ port: this.config.port + 1 });
        this.wsServer.on('connection', (ws, req) => {
            const sessionId = uuidv4();
            this.activeSessions.set(sessionId, ws);
            this.emit('ws:connection', { sessionId });
            ws.on('message', async (data) => {
                try {
                    const request = JSON.parse(data.toString());
                    const context = {
                        requestId: request.id ?? null,
                        sessionId,
                        userId: req.headers['x-user-id'] || 'anonymous',
                        metadata: {
                            ip: req.socket.remoteAddress,
                        },
                    };
                    const response = await this.processRequest(request, context);
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify(response));
                    }
                }
                catch (error) {
                    const errorResponse = {
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
    ws;
    requestId = 0;
    pendingRequests = new Map();
    constructor(ws) {
        this.ws = ws;
        this.ws.on('message', (data) => {
            try {
                const response = JSON.parse(data.toString());
                if (typeof response.id === 'number') {
                    const pending = this.pendingRequests.get(response.id);
                    if (pending) {
                        if (response.error) {
                            pending.reject(new JsonRpcError(response.error.code, response.error.message, response.error.data));
                        }
                        else {
                            pending.resolve(response.result);
                        }
                        this.pendingRequests.delete(response.id);
                    }
                }
            }
            catch (error) {
                console.error('Failed to parse RPC response:', error);
            }
        });
    }
    /**
     * Call an RPC method
     */
    async call(method, params) {
        const id = ++this.requestId;
        const request = {
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
    notify(method, params) {
        const request = {
            jsonrpc: '2.0',
            method,
            params,
        };
        this.ws.send(JSON.stringify(request));
    }
    /**
     * Close the client connection
     */
    close() {
        this.ws.close();
    }
}
//# sourceMappingURL=server.js.map