package nexus.saaamllc.plugin.services

import com.intellij.openapi.components.Service
import com.intellij.openapi.project.Project
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.vfs.LocalFileSystem
import nexus.saaamllc.plugin.mcp.*
import nexus.saaamllc.plugin.mcp.tools.IntelligenceTools
import io.ktor.server.application.*
import io.ktor.server.cio.*
import io.ktor.server.engine.*
import io.ktor.server.routing.*
import io.ktor.server.websocket.*
import io.ktor.websocket.*
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import kotlinx.serialization.encodeToString
import java.io.File
import java.util.UUID
import kotlin.time.Duration.Companion.seconds

/**
 * MCP (Model Context Protocol) Service
 * Runs WebSocket server for AI integration
 *
 * This is the CORE of the plugin - exposes IDE capabilities to AI
 */
@Service(Service.Level.PROJECT)
class MCPService(private val project: Project) {

    private val logger = Logger.getInstance(MCPService::class.java)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val json = Json {
        ignoreUnknownKeys = true
        prettyPrint = true
    }

    private var server: EmbeddedServer<*, *>? = null
    private var port: Int = 0
    private var authToken: String = ""
    private val connections = mutableListOf<DefaultWebSocketServerSession>()

    private var initialized = false
    private var nextRequestId = 1

    /**
     * Start the MCP server
     */
    suspend fun start() {
        if (initialized) {
            logger.warn("MCP Server already running on port $port")
            return
        }

        try {
            // Generate auth token and find available port
            authToken = UUID.randomUUID().toString()
            port = findAvailablePort()

            logger.info("🚀 Starting MCP Server on port $port...")

            // Start Ktor WebSocket server
            server = embeddedServer(CIO, port = port) {
                install(WebSockets) {
                    pingPeriod = 15.seconds
                    timeout = 60.seconds
                    maxFrameSize = Long.MAX_VALUE
                    masking = false
                }

                routing {
                    webSocket("/mcp") {
                        handleConnection(this)
                    }
                }
            }.start(wait = false)

            // Write lock file
            writeLockFile()

            initialized = true
            logger.info("✅ MCP Server started on ws://localhost:$port/mcp")
            logger.info("🔑 Auth token: ${authToken.take(8)}...")

        } catch (e: Exception) {
            logger.error("Failed to start MCP Server", e)
            throw e
        }
    }

    /**
     * Handle WebSocket connection
     */
    private suspend fun handleConnection(session: DefaultWebSocketServerSession) {
        // Check authentication
        val authHeader = session.call.request.headers["X-Claude-Code-Ide-Authorization"]
        if (authHeader != authToken) {
            logger.warn("Unauthorized connection attempt")
            session.close(CloseReason(CloseReason.Codes.VIOLATED_POLICY, "Unauthorized"))
            return
        }

        logger.info("✅ Client connected to MCP server")
        connections.add(session)

        try {
            // Send initial notifications
            sendNotification(session, "notifications/ide_connected", buildJsonObject {
                put("project_path", project.basePath ?: "")
                put("project_name", project.name)
            })

            // Handle incoming messages
            for (frame in session.incoming) {
                if (frame is Frame.Text) {
                    val text = frame.readText()
                    handleMessage(session, text)
                }
            }
        } catch (e: Exception) {
            logger.error("WebSocket error", e)
        } finally {
            connections.remove(session)
            logger.info("Client disconnected from MCP server")
        }
    }

    /**
     * Handle incoming JSON-RPC message
     */
    private suspend fun handleMessage(session: DefaultWebSocketServerSession, text: String) {
        try {
            val message = json.decodeFromString<JSONRPCMessage>(text)

            when (message) {
                is JSONRPCRequest -> handleRequest(session, message)
                is JSONRPCNotification -> handleNotification(message)
                else -> logger.warn("Received unexpected message type")
            }
        } catch (e: Exception) {
            logger.error("Failed to handle message: $text", e)
            sendError(session, RequestId.NumberId(-1), -32700, "Parse error")
        }
    }

    /**
     * Handle JSON-RPC request
     */
    private suspend fun handleRequest(session: DefaultWebSocketServerSession, request: JSONRPCRequest) {
        logger.info("📨 Request: ${request.method}")

        val response = try {
            val result = when (request.method) {
                "initialize" -> handleInitialize(request.params)
                "tools/list" -> handleToolsList()
                "tools/call" -> handleToolCall(request.params)
                "ping" -> JsonObject(emptyMap())
                else -> {
                    sendError(session, request.id, -32601, "Method not found: ${request.method}")
                    return
                }
            }

            JSONRPCResponse(
                id = request.id,
                result = result
            )
        } catch (e: Exception) {
            logger.error("Error handling request: ${request.method}", e)
            JSONRPCResponse(
                id = request.id,
                error = JSONRPCError(-32603, "Internal error: ${e.message}")
            )
        }

        val responseJson = json.encodeToString(response)
        session.send(Frame.Text(responseJson))
    }

    /**
     * Handle initialize request
     */
    private suspend fun handleInitialize(params: JsonElement): JsonElement {
        logger.info("🤝 Initializing MCP connection...")

        val intelligenceService = NexusIntelligenceService.getInstance(project)
        if (!intelligenceService.isInitialized()) {
            // Initialize intelligence in background if not ready
            scope.launch {
                intelligenceService.initialize()
            }
        }

        return buildJsonObject {
            put("protocolVersion", "2024-11-05")
            put("capabilities", buildJsonObject {
                put("tools", buildJsonObject {
                    put("listChanged", true)
                })
                put("logging", buildJsonObject {})
            })
            put("serverInfo", buildJsonObject {
                put("name", "NEXUS Code - JetBrains Plugin")
                put("version", "0.1.0-alpha")
            })
        }
    }

    /**
     * Handle tools/list request
     */
    private suspend fun handleToolsList(): JsonElement {
        val tools = mutableListOf<Tool>()

        // Add intelligence tools if available
        val intelligenceService = NexusIntelligenceService.getInstance(project)
        intelligenceService.getTools()?.let { intelligenceTools ->
            tools.addAll(intelligenceTools.registerTools())
        }

        // TODO: Next session add other tools (file ops, diff, diagnostics, etc.)

        val toolsJson = tools.map { tool ->
            buildJsonObject {
                put("name", tool.name)
                put("description", tool.description)
                put("inputSchema", tool.inputSchema)
            }
        }

        return buildJsonObject {
            put("tools", JsonArray(toolsJson))
        }
    }

    /**
     * Handle tools/call request
     */
    private suspend fun handleToolCall(params: JsonElement): JsonElement {
        val request = try {
            json.decodeFromJsonElement<CallToolRequest>(params)
        } catch (e: Exception) {
            logger.error("Failed to parse tool call request", e)
            throw e
        }

        logger.info("🔧 Tool call: ${request.name}")

        val result = if (request.name.startsWith("context_")) {
            // Intelligence tools
            val intelligenceService = NexusIntelligenceService.getInstance(project)
            val tools = intelligenceService.getTools()

            if (tools != null && intelligenceService.isInitialized()) {
                tools.executeTool(request)
            } else {
                CallToolResult(
                    content = listOf(TextContent(text = "⏳ Intelligence is still initializing... Please try again in a moment.")),
                    isError = false
                )
            }
        } else {
            // TODO: Handle other tools
            CallToolResult(
                content = listOf(TextContent(text = "Unknown tool: ${request.name}")),
                isError = true
            )
        }

        return json.encodeToJsonElement(result)
    }

    /**
     * Handle notification (fire-and-forget)
     */
    private suspend fun handleNotification(notification: JSONRPCNotification) {
        logger.info("📬 Notification: ${notification.method}")

        when (notification.method) {
            "notifications/initialized" -> {
                logger.info("✅ Client initialized")
            }
            else -> {
                logger.warn("Unknown notification: ${notification.method}")
            }
        }
    }

    /**
     * Send notification to client
     */
    private suspend fun sendNotification(session: DefaultWebSocketServerSession, method: String, params: JsonElement) {
        val notification = JSONRPCNotification(method, params)
        val json = this.json.encodeToString(notification)
        session.send(Frame.Text(json))
    }

    /**
     * Send error response
     */
    private suspend fun sendError(session: DefaultWebSocketServerSession, id: RequestId, code: Int, message: String) {
        val response = JSONRPCResponse(
            id = id,
            error = JSONRPCError(code, message)
        )
        val json = this.json.encodeToString(response)
        session.send(Frame.Text(json))
    }

    /**
     * Find available port
     */
    private fun findAvailablePort(): Int {
        for (port in 50000..60000) {
            try {
                java.net.ServerSocket(port).use { return port }
            } catch (e: Exception) {
                continue
            }
        }
        throw RuntimeException("No available ports found")
    }

    /**
     * Write lock file for client discovery
     */
    private fun writeLockFile() {
        val projectPath = project.basePath ?: return
        val lockDir = File(projectPath, ".nexus-code")
        lockDir.mkdirs()

        val lockFile = File(lockDir, "$port.json")
        val lockData = buildJsonObject {
            put("port", port)
            put("authToken", authToken)
            put("projectPath", projectPath)
            put("projectName", project.name)
        }

        lockFile.writeText(json.encodeToString(lockData))
        logger.info("📝 Lock file written: ${lockFile.absolutePath}")
    }

    /**
     * Delete lock file
     */
    private fun deleteLockFile() {
        val projectPath = project.basePath ?: return
        val lockFile = File(projectPath, ".nexus-code/$port.json")
        if (lockFile.exists()) {
            lockFile.delete()
            logger.info("🗑️  Lock file deleted")
        }
    }

    /**
     * Stop the server
     */
    fun stop() {
        logger.info("Stopping MCP Server...")

        // Close all connections
        runBlocking {
            connections.forEach { session ->
                session.close(CloseReason(CloseReason.Codes.NORMAL, "Server shutting down"))
            }
        }
        connections.clear()

        // Stop server
        server?.stop(1000, 5000)
        server = null

        // Delete lock file
        deleteLockFile()

        initialized = false
        logger.info("✅ MCP Server stopped")
    }

    /**
     * Cleanup on project close
     */
    fun dispose() {
        stop()
        scope.cancel()
    }

    companion object {
        fun getInstance(project: Project): MCPService {
            return project.getService(MCPService::class.java)
        }
    }
}
