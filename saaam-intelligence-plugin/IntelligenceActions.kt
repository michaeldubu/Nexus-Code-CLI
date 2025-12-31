package com.saaam.nexus.plugin.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.ui.popup.JBPopupFactory
import com.intellij.openapi.ui.popup.PopupStep
import com.intellij.openapi.ui.popup.util.BaseListPopupStep
import com.intellij.ui.components.JBScrollPane
import com.intellij.ui.components.JBTextArea
import com.saaam.nexus.plugin.services.NexusIntelligenceService
import kotlinx.coroutines.*
import javax.swing.JComponent
import java.awt.Dimension

/**
 * Show Project Context Summary Action
 * Displays intelligent overview of the entire project
 */
class ShowContextSummaryAction : AnAction() {
    
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val service = NexusIntelligenceService.getInstance(project)
        
        if (!service.isInitialized()) {
            Messages.showInfoMessage(
                project,
                "Context Intelligence is still initializing. Please wait a moment.",
                "NEXUS Intelligence"
            )
            return
        }
        
        val intelligence = service.getIntelligence() ?: return
        val summary = intelligence.getSummary()
        
        // Show in a nice dialog
        showTextDialog(project, "Project Context Summary", summary)
    }

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabled = e.project != null
    }
}

/**
 * Find Relevant Files Action
 * Intelligent file discovery based on query
 */
class FindRelevantFilesAction : AnAction() {
    
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val service = NexusIntelligenceService.getInstance(project)
        
        if (!service.isInitialized()) {
            Messages.showInfoMessage(
                project,
                "Context Intelligence is still initializing. Please wait a moment.",
                "NEXUS Intelligence"
            )
            return
        }
        
        // Prompt for query
        val query = Messages.showInputDialog(
            project,
            "Enter search query (e.g., 'authentication', 'user profile'):",
            "Find Relevant Files",
            Messages.getQuestionIcon()
        ) ?: return
        
        if (query.isBlank()) return
        
        val intelligence = service.getIntelligence() ?: return
        
        // Search in background
        CoroutineScope(Dispatchers.Main).launch {
            val results = withContext(Dispatchers.IO) {
                intelligence.calculateRelevance(query, emptyList())
            }
            
            if (results.isEmpty()) {
                Messages.showInfoMessage(
                    project,
                    "No relevant files found for: \"$query\"",
                    "NEXUS Intelligence"
                )
                return@launch
            }
            
            // Show results in popup
            val items = results.map { 
                "${it.file} (score: ${it.score.toInt()})" 
            }
            
            JBPopupFactory.getInstance()
                .createListPopup(object : BaseListPopupStep<String>("Relevant Files", items) {
                    override fun onChosen(selectedValue: String?, finalChoice: Boolean): PopupStep<*>? {
                        if (finalChoice && selectedValue != null) {
                            val filePath = selectedValue.substringBefore(" (score:")
                            // Would open the file here
                            Messages.showInfoMessage(project, "Selected: $filePath", "NEXUS")
                        }
                        return FINAL_CHOICE
                    }
                })
                .showCenteredInCurrentWindow(project)
        }
    }

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabled = e.project != null
    }
}

/**
 * Analyze Current File Action
 * Shows detailed analysis of the currently open file
 */
class AnalyzeCurrentFileAction : AnAction() {
    
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val editor = e.getData(CommonDataKeys.EDITOR) ?: return
        val file = e.getData(CommonDataKeys.VIRTUAL_FILE) ?: return
        
        val service = NexusIntelligenceService.getInstance(project)
        
        if (!service.isInitialized()) {
            Messages.showInfoMessage(
                project,
                "Context Intelligence is still initializing. Please wait a moment.",
                "NEXUS Intelligence"
            )
            return
        }
        
        val intelligence = service.getIntelligence() ?: return
        val context = intelligence.getContext() ?: return
        
        val basePath = project.basePath ?: return
        val relativePath = file.path.removePrefix("$basePath/")
        
        val node = context.graph.nodes[relativePath]
        if (node == null) {
            Messages.showInfoMessage(
                project,
                "File not found in context: $relativePath",
                "NEXUS Intelligence"
            )
            return
        }
        
        val analysis = buildString {
            appendLine("🔬 FILE ANALYSIS: ${file.name}")
            appendLine("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            appendLine()
            appendLine("📊 METRICS")
            appendLine("  Path: $relativePath")
            appendLine("  Lines: ${node.lines}")
            appendLine("  Size: ${String.format("%.2f", node.size / 1024.0)} KB")
            appendLine("  Language: ${node.language}")
            appendLine("  Complexity: ${String.format("%.2f", node.complexity)}")
            appendLine("  Usage Count: ${node.usageCount} references")
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
            
            val reverseDeps = context.graph.reverseEdges[relativePath] ?: emptyList()
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
                node.exports.take(15).forEach { exp ->
                    appendLine("  • $exp")
                }
                if (node.exports.size > 15) {
                    appendLine("  ... and ${node.exports.size - 15} more")
                }
            }
            
            // Warnings
            appendLine()
            appendLine("⚠️  NOTES")
            if (node.complexity > 15.0) {
                appendLine("  🔴 Very high complexity - consider refactoring")
            } else if (node.complexity > 10.0) {
                appendLine("  🟠 High complexity - may need attention")
            }
            
            if (reverseDeps.size > 15) {
                appendLine("  🟡 Many dependents - changes will have wide impact")
            }
            
            if (node.usageCount == 0) {
                appendLine("  ℹ️  No other files reference this - may be unused")
            }
        }
        
        showTextDialog(project, "File Analysis: ${file.name}", analysis)
    }

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabled = e.project != null && e.getData(CommonDataKeys.EDITOR) != null
    }
}

/**
 * Show Complex Files Action
 * Lists files with high complexity that may need refactoring
 */
class ShowComplexFilesAction : AnAction() {
    
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val service = NexusIntelligenceService.getInstance(project)
        
        if (!service.isInitialized()) {
            Messages.showInfoMessage(
                project,
                "Context Intelligence is still initializing. Please wait a moment.",
                "NEXUS Intelligence"
            )
            return
        }
        
        val intelligence = service.getIntelligence() ?: return
        val context = intelligence.getContext() ?: return
        
        if (context.complexFiles.isEmpty()) {
            Messages.showInfoMessage(
                project,
                "✅ No overly complex files detected! Your code looks healthy.",
                "NEXUS Intelligence"
            )
            return
        }
        
        val analysis = buildString {
            appendLine("⚠️  COMPLEX FILES")
            appendLine("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            appendLine()
            appendLine("Files sorted by complexity (highest first):")
            appendLine()
            
            context.complexFiles.take(20).forEachIndexed { index, node ->
                val rating = when {
                    node.complexity < 5.0 -> "🟢 LOW"
                    node.complexity < 10.0 -> "🟡 MODERATE"
                    node.complexity < 15.0 -> "🟠 HIGH"
                    else -> "🔴 VERY HIGH"
                }
                
                appendLine("${index + 1}. $rating ${node.relativePath}")
                appendLine("   Complexity: ${String.format("%.2f", node.complexity)} | ${node.lines} lines")
                appendLine()
            }
            
            appendLine("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            appendLine()
            appendLine("💡 RECOMMENDATIONS:")
            appendLine("  • Consider refactoring VERY HIGH complexity files")
            appendLine("  • Break down large functions into smaller ones")
            appendLine("  • Reduce nesting levels and conditional logic")
            appendLine("  • Extract complex conditions into named variables")
        }
        
        showTextDialog(project, "Complex Files", analysis)
    }

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabled = e.project != null
    }
}

/**
 * Helper function to show text in a dialog
 */
private fun showTextDialog(project: com.intellij.openapi.project.Project, title: String, text: String) {
    val textArea = JBTextArea(text).apply {
        isEditable = false
        font = java.awt.Font("Monospaced", java.awt.Font.PLAIN, 12)
    }
    
    val scrollPane = JBScrollPane(textArea).apply {
        preferredSize = Dimension(800, 600)
    }
    
    Messages.showDialog(
        project,
        scrollPane,
        title,
        arrayOf("Close"),
        0,
        Messages.getInformationIcon()
    )
}
