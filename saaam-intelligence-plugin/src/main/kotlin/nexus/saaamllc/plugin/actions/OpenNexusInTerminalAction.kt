package nexus.saaamllc.plugin.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.terminal.JBTerminalWidget
import nexus.saaamllc.plugin.services.MCPService
import java.io.File

/**
 * Action to open Nexus CLI in terminal
 */
class OpenNexusInTerminalAction : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return

        // Get MCP service info
        val mcpService = MCPService.getInstance(project)

        // Open terminal
        openTerminal(project)
    }

    private fun openTerminal(project: Project) {
        val toolWindowManager = ToolWindowManager.getInstance(project)
        val terminalToolWindow = toolWindowManager.getToolWindow("Terminal")

        if (terminalToolWindow != null) {
            terminalToolWindow.activate(null)
        }
    }

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabled = e.project != null
    }
}
