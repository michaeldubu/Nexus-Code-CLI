package nexus.saaamllc.plugin.mcp.tools

import com.intellij.openapi.project.Project
import nexus.saaamllc.plugin.intelligence.ContextIntelligence
import nexus.saaamllc.plugin.intelligence.RelevanceScore
import nexus.saaamllc.plugin.mcp.*
import kotlinx.serialization.json.*
import kotlinx.coroutines.*

/**
 * Context Intelligence MCP Tools
 * Exposes project understanding capabilities through MCP protocol
 */

class IntelligenceTools(
    private val project: Project,
    private val intelligence: ContextIntelligence
) {

    /**
     * Register all intelligence tools with MCP server
     */
    fun registerTools(): List<Tool> = listOf(
        createContextTool(),
        createRelevantFilesTool(),
        createAnalyzeTool(),
        createDependenciesTool(),
        createSuggestTool(),
        createComplexityTool()
    )

    /**
     * Handle tool execution
     */
    suspend fun executeTool(request: CallToolRequest): CallToolResult = when (request.name) {
        "context_get_summary" -> handleContextSummary()
        "context_find_relevant" -> handleFindRelevant(request.arguments)
        "context_analyze_file" -> handleAnalyzeFile(request.arguments)
        "context_get_dependencies" -> handleGetDependencies(request.arguments)
        "context_suggest" -> handleSuggest()
        "context_complexity" -> handleComplexity()
        else -> CallToolResult(
            content = listOf(TextContent(text = "Unknown tool: ${request.name}")),
            isError = true
        )
    }

    // ========== Tool Definitions ==========

    private fun createContextTool() = Tool(
        name = "context_get_summary",
        description = """
            Get an overview of the entire project structure and context.

            Returns information about:
            - Total files and languages
            - Detected frameworks
            - Entry points
            - Complex files
            - Hot spots (frequently modified files)

            Use this to understand the project before making changes.
        """.trimIndent(),
        inputSchema = buildJsonObject {
            put("type", "object")
            put("properties", buildJsonObject {})
            put("required", JsonArray(emptyList()))
        }
    )

    private fun createRelevantFilesTool() = Tool(
        name = "context_find_relevant",
        description = """
            Find files relevant to a specific query or task.

            Uses intelligent scoring based on:
            - Path and filename matching
            - Dependency relationships
            - Import/export patterns
            - Usage frequency
            - Co-change patterns

            Example queries:
            - "authentication system"
            - "user profile page"
            - "API client"
            - "database connection"

            Returns top 20 relevant files with relevance scores and reasons.
        """.trimIndent(),
        inputSchema = buildJsonObject {
            put("type", "object")
            put("properties", buildJsonObject {
                put("query", buildJsonObject {
                    put("type", "string")
                    put("description", "The query to search for (e.g., 'authentication', 'user profile')")
                })
                put("current_files", buildJsonObject {
                    put("type", "array")
                    put("description", "Currently open or relevant files (optional)")
                    put("items", buildJsonObject {
                        put("type", "string")
                    })
                })
            })
            put("required", JsonArray(listOf(JsonPrimitive("query"))))
        }
    )

    private fun createAnalyzeTool() = Tool(
        name = "context_analyze_file",
        description = """
            Get detailed analysis of a specific file.

            Returns:
            - File metrics (lines, size, complexity)
            - Dependencies (what this file imports)
            - Reverse dependencies (what imports this file)
            - Exported symbols
            - Usage count
            - Language and framework info

            Use before modifying a file to understand its impact.
        """.trimIndent(),
        inputSchema = buildJsonObject {
            put("type", "object")
            put("properties", buildJsonObject {
                put("file_path", buildJsonObject {
                    put("type", "string")
                    put("description", "Relative path to the file from project root")
                })
            })
            put("required", JsonArray(listOf(JsonPrimitive("file_path"))))
        }
    )

    private fun createDependenciesTool() = Tool(
        name = "context_get_dependencies",
        description = """
            Get dependency tree for a file.

            Shows:
            - What files this file depends on (direct and transitive)
            - What files depend on this file
            - Dependency depth and complexity

            Use to understand impact of changes.
        """.trimIndent(),
        inputSchema = buildJsonObject {
            put("type", "object")
            put("properties", buildJsonObject {
                put("file_path", buildJsonObject {
                    put("type", "string")
                    put("description", "Relative path to the file from project root")
                })
                put("depth", buildJsonObject {
                    put("type", "number")
                    put("description", "Maximum depth to traverse (default: 3)")
                    put("default", 3)
                })
            })
            put("required", JsonArray(listOf(JsonPrimitive("file_path"))))
        }
    )

    private fun createSuggestTool() = Tool(
        name = "context_suggest",
        description = """
            Get intelligent suggestions for code improvements.

            Analyzes the project and suggests:
            - Files that need tests
            - Complex code that should be refactored
            - Files with many dependents (risky to change)
            - Missing documentation

            Run this periodically to maintain code health.
        """.trimIndent(),
        inputSchema = buildJsonObject {
            put("type", "object")
            put("properties", buildJsonObject {})
            put("required", JsonArray(emptyList()))
        }
    )

    private fun createComplexityTool() = Tool(
        name = "context_complexity",
        description = """
            Get files sorted by complexity.

            Returns files with highest cyclomatic complexity,
            indicating code that may need refactoring.

            Complexity is calculated using real AST analysis,
            not regex pattern matching.
        """.trimIndent(),
        inputSchema = buildJsonObject {
            put("type", "object")
            put("properties", buildJsonObject {
                put("limit", buildJsonObject {
                    put("type", "number")
                    put("description", "Maximum number of files to return (default: 15)")
                    put("default", 15)
                })
            })
            put("required", JsonArray(emptyList()))
        }
    )

    // ========== Tool Handlers ==========

    private suspend fun handleContextSummary(): CallToolResult {
        val summary = intelligence.getSummary()

        return CallToolResult(
            content = listOf(TextContent(text = summary))
        )
    }

    private suspend fun handleFindRelevant(args: JsonObject): CallToolResult {
        val query = args["query"]?.jsonPrimitive?.content
            ?: return errorResult("Missing 'query' parameter")

        val currentFiles = args["current_files"]?.jsonArray?.mapNotNull {
            it.jsonPrimitive.contentOrNull
        } ?: emptyList()

        val scores = intelligence.calculateRelevance(query, currentFiles)

        if (scores.isEmpty()) {
            return CallToolResult(
                content = listOf(TextContent(text = "⚠️  No relevant files found for: \"$query\""))
            )
        }

        val result = buildString {
            appendLine("🎯 RELEVANT FILES FOR: \"$query\"")
            appendLine("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            appendLine()

            scores.forEachIndexed { index, score ->
                val bar = createScoreBar(score.score)
                appendLine("${index + 1}. $bar ${score.file}")
                appendLine("   Score: ${String.format("%.0f", score.score)}")
                if (score.reasons.isNotEmpty()) {
                    appendLine("   Reasons: ${score.reasons.take(2).joinToString(", ")}")
                }
                appendLine()
            }

            appendLine("💡 Top ${scores.size} files shown. Use context_analyze_file for details.")
        }

        return CallToolResult(content = listOf(TextContent(text = result)))
    }

    private suspend fun handleAnalyzeFile(args: JsonObject): CallToolResult {
        val filePath = args["file_path"]?.jsonPrimitive?.content
            ?: return errorResult("Missing 'file_path' parameter")

        val context = intelligence.getContext()
            ?: return errorResult("Context not initialized")

        val node = context.graph.nodes[filePath]
            ?: return errorResult("File not found: $filePath")

        val result = buildString {
            appendLine("🔬 ANALYZING: $filePath")
            appendLine("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            appendLine()
            appendLine("📊 METRICS")
            appendLine("  Lines: ${node.lines}")
            appendLine("  Size: ${String.format("%.2f", node.size / 1024.0)} KB")
            appendLine("  Language: ${node.language}")
            appendLine("  Complexity: ${String.format("%.2f", node.complexity)} (${complexityRating(node.complexity)})")
            appendLine("  Usage Count: ${node.usageCount} files reference this")
            appendLine()

            if (node.dependencies.isNotEmpty()) {
                appendLine("📦 DEPENDENCIES (${node.dependencies.size})")
                node.dependencies.take(10).forEach { dep ->
                    appendLine("  → $dep")
                }
                if (node.dependencies.size > 10) {
                    appendLine("  ... and ${node.dependencies.size - 10} more")
                }
                appendLine()
            }

            val reverseDeps = context.graph.reverseEdges[filePath] ?: emptyList()
            if (reverseDeps.isNotEmpty()) {
                appendLine("🔄 IMPORTED BY (${reverseDeps.size})")
                reverseDeps.take(10).forEach { dep ->
                    appendLine("  ← $dep")
                }
                if (reverseDeps.size > 10) {
                    appendLine("  ... and ${reverseDeps.size - 10} more")
                }
                appendLine()
            }

            if (node.exports.isNotEmpty()) {
                appendLine("📤 EXPORTS (${node.exports.size})")
                node.exports.take(10).forEach { exp ->
                    appendLine("  • $exp")
                }
                if (node.exports.size > 10) {
                    appendLine("  ... and ${node.exports.size - 10} more")
                }
            }
        }

        return CallToolResult(content = listOf(TextContent(text = result)))
    }

    private suspend fun handleGetDependencies(args: JsonObject): CallToolResult {
        val filePath = args["file_path"]?.jsonPrimitive?.content
            ?: return errorResult("Missing 'file_path' parameter")

        val depth = args["depth"]?.jsonPrimitive?.intOrNull ?: 3

        val context = intelligence.getContext()
            ?: return errorResult("Context not initialized")

        val result = buildDependencyTree(filePath, context, depth)

        return CallToolResult(content = listOf(TextContent(text = result)))
    }

    private suspend fun handleSuggest(): CallToolResult {
        val context = intelligence.getContext()
            ?: return errorResult("Context not initialized")

        val suggestions = mutableListOf<String>()

        // Find files without tests
        context.graph.nodes.values
            .filter { node ->
                !context.testFiles.any { it.contains(node.relativePath) } &&
                node.language in listOf("kotlin", "java", "typescript", "javascript")
            }
            .sortedByDescending { it.usageCount }
            .take(5)
            .forEach { node ->
                suggestions.add(
                    "🧪 ${node.relativePath}\n" +
                    "   No tests found - consider adding tests\n" +
                    "   (${node.usageCount} usages, ${node.lines} lines)"
                )
            }

        // Find complex files
        context.complexFiles.take(5).forEach { node ->
            if (node.complexity > 10.0) {
                suggestions.add(
                    "🔧 ${node.relativePath}\n" +
                    "   High complexity: ${String.format("%.1f", node.complexity)}\n" +
                    "   Consider refactoring (${node.lines} lines)"
                )
            }
        }

        // Find files with many dependents
        context.graph.reverseEdges
            .filter { (_, dependents) -> dependents.size > 10 }
            .entries
            .sortedByDescending { it.value.size }
            .take(3)
            .forEach { (file, dependents) ->
                suggestions.add(
                    "⚠️  $file\n" +
                    "   ${dependents.size} files depend on this\n" +
                    "   Changes here will have wide impact"
                )
            }

        if (suggestions.isEmpty()) {
            return CallToolResult(
                content = listOf(TextContent(text = "✅ No critical suggestions - code looks healthy!"))
            )
        }

        val result = buildString {
            appendLine("💡 INTELLIGENT SUGGESTIONS")
            appendLine("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            appendLine()
            suggestions.forEach { suggestion ->
                appendLine(suggestion)
                appendLine()
            }
        }

        return CallToolResult(content = listOf(TextContent(text = result)))
    }

    private suspend fun handleComplexity(): CallToolResult {
        val context = intelligence.getContext()
            ?: return errorResult("Context not initialized")

        val result = buildString {
            appendLine("⚠️  COMPLEX FILES")
            appendLine("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            appendLine()

            if (context.complexFiles.isEmpty()) {
                appendLine("✅ No overly complex files detected!")
            } else {
                context.complexFiles.take(15).forEach { node ->
                    val rating = complexityRating(node.complexity)
                    appendLine("$rating ${node.relativePath}")
                    appendLine("   Complexity: ${String.format("%.2f", node.complexity)} | ${node.lines} lines")
                    appendLine()
                }

                appendLine("💡 Consider refactoring files with high complexity")
            }
        }

        return CallToolResult(content = listOf(TextContent(text = result)))
    }

    // ========== Helper Functions ==========

    private fun buildDependencyTree(
        filePath: String,
        context: nexus.saaamllc.plugin.intelligence.ProjectContext,
        maxDepth: Int
    ): String = buildString {
        appendLine("📦 DEPENDENCY TREE: $filePath")
        appendLine("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        appendLine()

        val visited = mutableSetOf<String>()

        fun buildTree(file: String, depth: Int, prefix: String) {
            if (depth >= maxDepth || file in visited) return
            visited.add(file)

            val deps = context.graph.edges[file] ?: emptyList()
            if (deps.isEmpty()) return

            deps.forEachIndexed { index, dep ->
                val isLast = index == deps.size - 1
                val connector = if (isLast) "└─" else "├─"
                val nextPrefix = prefix + if (isLast) "  " else "│ "

                appendLine("$prefix$connector $dep")
                buildTree(dep, depth + 1, nextPrefix)
            }
        }

        appendLine("$filePath")
        buildTree(filePath, 0, "")

        val reverseDeps = context.graph.reverseEdges[filePath] ?: emptyList()
        if (reverseDeps.isNotEmpty()) {
            appendLine()
            appendLine("🔄 IMPORTED BY (${reverseDeps.size})")
            reverseDeps.take(10).forEach { dep ->
                appendLine("  • $dep")
            }
            if (reverseDeps.size > 10) {
                appendLine("  ... and ${reverseDeps.size - 10} more")
            }
        }
    }

    private fun createScoreBar(score: Double): String {
        val normalized = (score / 10.0).coerceIn(0.0, 10.0).toInt()
        val filled = "█".repeat(normalized)
        val empty = "░".repeat(10 - normalized)
        return filled + empty
    }

    private fun complexityRating(complexity: Double): String = when {
        complexity < 5.0 -> "🟢 LOW"
        complexity < 10.0 -> "🟡 MODERATE"
        complexity < 15.0 -> "🟠 HIGH"
        else -> "🔴 VERY HIGH"
    }

    private fun errorResult(message: String) = CallToolResult(
        content = listOf(TextContent(text = "❌ Error: $message")),
        isError = true
    )
}
