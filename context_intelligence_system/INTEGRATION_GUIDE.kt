/**
 * QUICK INTEGRATION GUIDE
 * How to wire Context Intelligence into your existing MCP server
 */

// ============================================
// STEP 1: Update your MCPService.kt
// ============================================

package com.saaam.nexus.plugin.services

import com.intellij.openapi.components.Service
import com.intellij.openapi.project.Project
import com.saaam.nexus.plugin.intelligence.ContextIntelligence
import com.saaam.nexus.plugin.mcp.tools.IntelligenceTools
import com.saaam.nexus.plugin.mcp.*
import kotlinx.coroutines.*

@Service(Service.Level.PROJECT)
class MCPService(private val project: Project) {
    
    private val intelligenceService by lazy {
        NexusIntelligenceService.getInstance(project)
    }
    
    /**
     * Handle incoming MCP tool calls
     */
    suspend fun handleToolCall(request: CallToolRequest): CallToolResult {
        // Check if it's an intelligence tool
        if (request.name.startsWith("context_")) {
            return intelligenceService.getTools()?.executeTool(request)
                ?: CallToolResult(
                    content = listOf(TextContent(text = "Intelligence not initialized")),
                    isError = true
                )
        }
        
        // Handle your other tools here
        return handleYourOtherTools(request)
    }
    
    /**
     * List all available tools
     */
    fun listTools(): ListToolsResult {
        val tools = mutableListOf<Tool>()
        
        // Add your existing tools
        tools.addAll(getYourExistingTools())
        
        // Add intelligence tools if ready
        intelligenceService.getTools()?.let { intelligenceTools ->
            tools.addAll(intelligenceTools.registerTools())
        }
        
        return ListToolsResult(tools = tools)
    }
    
    // Your existing methods...
    private fun handleYourOtherTools(request: CallToolRequest): CallToolResult {
        // Your existing tool handling
        TODO("Your existing implementation")
    }
    
    private fun getYourExistingTools(): List<Tool> {
        // Your existing tools
        TODO("Your existing implementation")
    }
}

// ============================================
// STEP 2: Update your WebSocket handler
// ============================================

class MCPWebSocketHandler(private val project: Project) {
    
    private val mcpService = MCPService(project)
    private val json = Json { ignoreUnknownKeys = true }
    
    suspend fun handleMessage(message: String): String {
        val jsonMessage = json.decodeFromString<JSONRPCMessage>(message)
        
        return when (jsonMessage) {
            is JSONRPCRequest -> {
                val response = when (jsonMessage.method) {
                    "tools/list" -> {
                        val result = mcpService.listTools()
                        JSONRPCResponse(
                            id = jsonMessage.id,
                            result = json.encodeToJsonElement(result)
                        )
                    }
                    
                    "tools/call" -> {
                        val params = json.decodeFromJsonElement<CallToolRequest>(jsonMessage.params)
                        val result = mcpService.handleToolCall(params)
                        JSONRPCResponse(
                            id = jsonMessage.id,
                            result = json.encodeToJsonElement(result)
                        )
                    }
                    
                    else -> JSONRPCResponse(
                        id = jsonMessage.id,
                        error = JSONRPCError(
                            code = -32601,
                            message = "Method not found: ${jsonMessage.method}"
                        )
                    )
                }
                
                json.encodeToString(response)
            }
            
            else -> {
                // Handle other message types
                ""
            }
        }
    }
}

// ============================================
// STEP 3: Example usage in your existing code
// ============================================

// When you want to manually trigger intelligence features:

class YourExistingCode {
    
    fun exampleUsage(project: Project) {
        val intelligenceService = NexusIntelligenceService.getInstance(project)
        
        // Check if ready
        if (!intelligenceService.isInitialized()) {
            println("Intelligence still initializing...")
            return
        }
        
        val intelligence = intelligenceService.getIntelligence()!!
        
        // Get project summary
        val summary = intelligence.getSummary()
        println(summary)
        
        // Find relevant files
        GlobalScope.launch {
            val relevant = intelligence.calculateRelevance("authentication", emptyList())
            relevant.forEach { score ->
                println("${score.file}: ${score.score}")
            }
        }
        
        // Get project context
        val context = intelligence.getContext()
        println("Total files: ${context?.graph?.nodes?.size}")
        println("Languages: ${context?.languages}")
        println("Frameworks: ${context?.frameworks}")
    }
}

// ============================================
// STEP 4: Testing the integration
// ============================================

class MCPIntegrationTest {
    
    suspend fun testIntelligenceTools() {
        val project = /* get your test project */
        val mcpService = MCPService(project)
        
        // Wait for initialization
        delay(5000)
        
        // Test tools list
        val toolsList = mcpService.listTools()
        assert(toolsList.tools.any { it.name == "context_get_summary" })
        assert(toolsList.tools.any { it.name == "context_find_relevant" })
        
        // Test context summary
        val summaryRequest = CallToolRequest(
            name = "context_get_summary",
            arguments = JsonObject(emptyMap())
        )
        val summaryResult = mcpService.handleToolCall(summaryRequest)
        assert(summaryResult.isError != true)
        println(summaryResult.content.first().text)
        
        // Test find relevant
        val relevantRequest = CallToolRequest(
            name = "context_find_relevant",
            arguments = buildJsonObject {
                put("query", "authentication")
            }
        )
        val relevantResult = mcpService.handleToolCall(relevantRequest)
        assert(relevantResult.isError != true)
        println(relevantResult.content.first().text)
    }
}

// ============================================
// STEP 5: Performance monitoring
// ============================================

class IntelligenceMonitor(private val project: Project) {
    
    private val logger = Logger.getInstance(IntelligenceMonitor::class.java)
    
    fun monitorPerformance() {
        val service = NexusIntelligenceService.getInstance(project)
        
        // Check initialization status
        GlobalScope.launch {
            repeat(10) {
                delay(1000)
                if (service.isInitialized()) {
                    val context = service.getIntelligence()?.getContext()
                    logger.info("""
                        Intelligence Ready:
                        - Files: ${context?.graph?.nodes?.size}
                        - Languages: ${context?.languages?.size}
                        - Frameworks: ${context?.frameworks?.joinToString()}
                    """.trimIndent())
                    return@launch
                } else {
                    logger.info("Still initializing... ($it/10)")
                }
            }
            logger.warn("Intelligence failed to initialize within 10 seconds")
        }
    }
}

// ============================================
// TIPS & TRICKS
// ============================================

/*
1. LAZY INITIALIZATION
   The intelligence initializes automatically on project open.
   Check isInitialized() before using.

2. BACKGROUND OPERATIONS
   All intelligence operations are suspending functions.
   Use appropriate coroutine scopes.

3. CACHING
   Relevance scores are cached. Clear cache on major file changes.
   The intelligence service has a refresh() method.

4. ERROR HANDLING
   Always check for null when getting intelligence instance.
   Tools return isError=true when something goes wrong.

5. TESTING
   Use small test projects first to verify integration.
   Check IDE logs for initialization messages.

6. PERFORMANCE
   Initial scan can take a few seconds on large projects.
   Subsequent queries are fast (<100ms).

7. MEMORY
   Intelligence graph uses 50-100MB for typical projects.
   IntelliJ's PSI is already in memory, so minimal overhead.

8. DEBUGGING
   Enable MCP debug logging in settings.
   Check for 🧠 emoji in IDE logs.
   Use the IDE actions to verify intelligence works.
*/

// ============================================
// COMMON ISSUES & SOLUTIONS
// ============================================

/*
ISSUE: Intelligence not initializing
SOLUTION: Check if project has source roots. Verify plugin.xml is correct.

ISSUE: Tools returning errors
SOLUTION: Verify file paths are relative to project root. Check if files exist.

ISSUE: Slow performance
SOLUTION: Wait for IntelliJ indexing to complete. Check bottom-right status bar.

ISSUE: Wrong relevance scores
SOLUTION: Clear cache and refresh. May need to rebuild intelligence.

ISSUE: Missing dependencies
SOLUTION: Ensure all imports resolved. Check build.gradle.kts dependencies.
*/
