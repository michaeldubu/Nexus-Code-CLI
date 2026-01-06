package nexus.saaamllc.plugin.services

import com.intellij.openapi.components.Service
import com.intellij.openapi.project.Project
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.startup.ProjectActivity
import nexus.saaamllc.plugin.intelligence.ContextIntelligence
import nexus.saaamllc.plugin.mcp.tools.IntelligenceTools
import kotlinx.coroutines.*

/**
 * Project-level service that manages Context Intelligence
 * Initializes on project open and provides access to intelligence features
 */
@Service(Service.Level.PROJECT)
class NexusIntelligenceService(private val project: Project) {

    private val logger = Logger.getInstance(NexusIntelligenceService::class.java)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private var intelligence: ContextIntelligence? = null
    private var tools: IntelligenceTools? = null
    private var initialized = false

    /**
     * Initialize the intelligence system
     * Called automatically on project startup
     */
    suspend fun initialize() {
        if (initialized) {
            logger.warn("Intelligence already initialized")
            return
        }

        try {
            logger.info("🧠 Initializing Nexus Context Intelligence...")

            val intel = ContextIntelligence(project)
            intel.initialize()

            this.intelligence = intel
            this.tools = IntelligenceTools(project, intel)
            this.initialized = true

            logger.info("✅ Nexus Context Intelligence ready!")
        } catch (e: Exception) {
            logger.error("Failed to initialize Context Intelligence", e)
            throw e
        }
    }

    /**
     * Get the intelligence engine
     */
    fun getIntelligence(): ContextIntelligence? = intelligence

    /**
     * Get the MCP tools
     */
    fun getTools(): IntelligenceTools? = tools

    /**
     * Check if initialized
     */
    fun isInitialized(): Boolean = initialized

    /**
     * Refresh intelligence after file changes
     */
    suspend fun refresh(changedFiles: List<String> = emptyList()) {
        intelligence?.let { intel ->
            logger.info("🔄 Refreshing context intelligence...")
            if (changedFiles.isEmpty()) {
                // Full refresh
                intel.initialize()
            } else {
                // Partial refresh for specific files
                changedFiles.forEach { file ->
                    // Would implement incremental refresh here
                }
            }
        }
    }

    /**
     * Cleanup on project close
     */
    fun dispose() {
        scope.cancel()
        intelligence = null
        tools = null
        initialized = false
        logger.info("🧠 Context Intelligence disposed")
    }

    companion object {
        /**
         * Get the service instance for a project
         */
        fun getInstance(project: Project): NexusIntelligenceService {
            return project.getService(NexusIntelligenceService::class.java)
        }
    }
}

/**
 * Project startup activity that initializes intelligence
 */
class NexusIntelligenceStartup : ProjectActivity {

    private val logger = Logger.getInstance(NexusIntelligenceStartup::class.java)

    override suspend fun execute(project: Project) {
        logger.info("🚀 Nexus plugin starting for project: ${project.name}")

        try {
            val service = NexusIntelligenceService.getInstance(project)

            // Initialize in background
            withContext(Dispatchers.IO) {
                service.initialize()
            }

            logger.info("✅ Nexus intelligence initialized for: ${project.name}")
        } catch (e: Exception) {
            logger.error("Failed to start Nexus intelligence", e)
        }
    }
}
