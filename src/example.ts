/**
 * Nexus Code - Comprehensive Example
 * Demonstrates the full multi-agent system in action
 */

import { createNexusCode } from './index.js';
import { NexusConfig, TaskPriority } from './core/types/index.js';
import { config } from 'dotenv';

// Load environment variables
config();

/**
 * Main example function
 */
async function main() {
  console.log('🚀 Nexus Code - Multi-Agent AI Coding System\n');

  // Configuration
  const nexusConfig: NexusConfig = {
    // Core settings
    maxConcurrentAgents: 5,
    maxTasksPerAgent: 3,
    defaultTimeout: 300000, // 5 minutes

    // LLM settings
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    model: 'claude-sonnet-4-5-20250929',
    maxTokens: 4096,
    temperature: 0.7,

    // Security settings
    security: {
      enableSandbox: false, // Set to true to enable Docker sandboxing
      sandboxType: 'docker',
      autoApprove: true, // Allow automatic command execution
      permissionMode: 'permissive',
    },

    // Integration settings
    github: process.env.GITHUB_TOKEN ? {
      owner: process.env.GITHUB_OWNER || '',
      repo: process.env.GITHUB_REPO || '',
      token: process.env.GITHUB_TOKEN,
    } : undefined,

    // Logging settings
    logging: {
      level: 'info',
      auditEnabled: true,
      provenanceTracking: true,
    },

    // UI settings
    ui: {
      terminal: true,
      colorEnabled: true,
      verboseOutput: true,
    },
  };

  // Create Nexus Code instance
  console.log('📦 Initializing Nexus Code...\n');
  const result = await createNexusCode(nexusConfig);

  if (!result.success) {
    console.error('❌ Failed to initialize:', result.error.message);
    process.exit(1);
  }

  const nexus = result.data;

  // Setup event listeners for visibility
  nexus.on('system:initialized', () => {
    console.log('✅ System initialized successfully!\n');
  });

  nexus.on('task:started', (data) => {
    console.log(`🔄 Task started: ${data.taskId}`);
  });

  nexus.on('task:completed', (data) => {
    console.log(`✅ Task completed: ${data.taskId}`);
  });

  nexus.on('task:failed', (data) => {
    console.error(`❌ Task failed: ${data.taskId}`, data.error?.message);
  });

  nexus.on('audit:log', (log) => {
    if (nexusConfig.ui.verboseOutput) {
      console.log(`📝 [AUDIT] ${log.action} - ${log.result}`);
    }
  });

  // Example 1: Generate a simple Express.js API
  console.log('═══════════════════════════════════════════════');
  console.log('Example 1: Generate Express.js REST API');
  console.log('═══════════════════════════════════════════════\n');

  const apiResult = await nexus.generateCode(
    'Create a production-ready Express.js REST API with user authentication',
    [
      'Use TypeScript',
      'Include JWT-based authentication',
      'Add input validation with Zod',
      'Include error handling middleware',
      'Add comprehensive logging',
      'Include basic CRUD operations for users',
      'Add rate limiting',
      'Include health check endpoint',
    ],
    {
      framework: 'express',
      language: 'typescript',
      features: ['auth', 'validation', 'logging', 'rate-limiting'],
    },
  );

  if (apiResult.success) {
    console.log('\n✅ API generated successfully!');
    console.log('📄 Generated code:', JSON.stringify(apiResult.data, null, 2));
  } else {
    console.error('\n❌ API generation failed:', apiResult.error.message);
  }

  // Example 2: Security Analysis
  console.log('\n═══════════════════════════════════════════════');
  console.log('Example 2: Security Analysis');
  console.log('═══════════════════════════════════════════════\n');

  const securityResult = await nexus.analyzeSecurity('./package.json');

  if (securityResult.success) {
    console.log('\n✅ Security analysis complete!');
    console.log('🔒 Security report:', JSON.stringify(securityResult.data, null, 2));
  } else {
    console.error('\n❌ Security analysis failed:', securityResult.error.message);
  }

  // Example 3: Complex Multi-Agent Workflow
  console.log('\n═══════════════════════════════════════════════');
  console.log('Example 3: Multi-Agent Workflow');
  console.log('═══════════════════════════════════════════════\n');

  const workflowResult = await nexus.executeTask(
    'Build a complete microservice with tests and documentation',
    {
      service: 'user-management',
      requirements: [
        'User registration and authentication',
        'Email verification',
        'Password reset functionality',
        'Rate limiting',
        'Unit tests with >80% coverage',
        'Integration tests',
        'API documentation',
        'Docker support',
      ],
    },
  );

  if (workflowResult.success) {
    console.log('\n✅ Workflow completed successfully!');
    const context = workflowResult.data;
    console.log(`\n📊 Execution Summary:`);
    console.log(`   ├─ Duration: ${Date.now() - context.startTime.getTime()}ms`);
    console.log(`   ├─ Completed Tasks: ${context.completedTasks.size}`);
    console.log(`   ├─ Failed Tasks: ${context.failedTasks.size}`);
    console.log(`   └─ Artifacts: ${context.artifacts.size}`);
  } else {
    console.error('\n❌ Workflow failed:', workflowResult.error.message);
  }

  // Display system status
  console.log('\n═══════════════════════════════════════════════');
  console.log('System Status');
  console.log('═══════════════════════════════════════════════\n');

  const status = nexus.getStatus();
  console.log('📊 System Status:');
  console.log(JSON.stringify(status, null, 2));

  // Display audit statistics
  console.log('\n📝 Audit Statistics:');
  const auditStats = nexus.getAuditLogger().getStats();
  console.log(JSON.stringify(auditStats, null, 2));

  // Display provenance statistics
  console.log('\n🔗 Provenance Statistics:');
  const provenanceStats = nexus.getProvenanceTracker().getStats();
  console.log(JSON.stringify(provenanceStats, null, 2));

  // Graceful shutdown
  console.log('\n═══════════════════════════════════════════════');
  console.log('Shutting Down');
  console.log('═══════════════════════════════════════════════\n');

  await nexus.shutdown();
  console.log('✅ System shutdown complete!');
  console.log('\n🎉 Nexus Code example completed successfully!\n');
}

// Run the example
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
