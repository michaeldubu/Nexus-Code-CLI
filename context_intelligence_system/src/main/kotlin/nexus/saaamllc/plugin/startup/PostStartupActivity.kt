package nexus.saaamllc.plugin.startup

import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.ProjectActivity
import nexus.saaamllc.plugin.services.MCPService
import nexus.saaamllc.plugin.services.NexusIntelligenceService
import kotlinx.coroutines.*

/**
 * Startup activity - initializes NEXUS when project opens
 */
class PostStartupActivity : ProjectActivity {

    private val logger = Logger.getInstance(PostStartupActivity::class.java)

    override suspend fun execute(project: Project) {
        logger.info("🚀 NEXUS Code plugin starting for project: ${project.name}")

        try {
            coroutineScope {
                // Start intelligence initialization in background
                val intelligenceService = NexusIntelligenceService.getInstance(project)
                launch(Dispatchers.IO) {
                    logger.info("🧠 Initializing Context Intelligence...")
                    intelligenceService.initialize()
                    logger.info("✅ Context Intelligence ready!")
                }

                // Start MCP server
                val mcpService = MCPService.getInstance(project)
                withContext(Dispatchers.IO) {
                    mcpService.start()
                }
            }

            logger.info("✅ NEXUS Code plugin fully initialized for: ${project.name}")

            // Show notification
            NotificationGroupManager.getInstance()
                .getNotificationGroup("NEXUS Code")
                .createNotification(
                    "NEXUS Code Active",
                    "MCP Server running. Check .nexus-code/ for connection details.",
                    NotificationType.INFORMATION
                )
                .notify(project)

        } catch (e: Exception) {
            logger.error("Failed to start NEXUS Code plugin", e)

            // Show error notification
            NotificationGroupManager.getInstance()
                .getNotificationGroup("NEXUS Code")
                .createNotification(
                    "NEXUS Code Error",
                    "Failed to start: ${e.message}",
                    NotificationType.ERROR
                )
                .notify(project)
        }
    }
}
