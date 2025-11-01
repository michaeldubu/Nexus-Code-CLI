
// src/transport/ProcessTransport.ts
class ProcessTransport {
  options;
  child;
  childStdin;
  childStdout;
  ready = false;
  abortController;
  exitError;
  exitListeners = [];
  processExitHandler;
  abortHandler;
  constructor(options) {
    this.options = options;
    this.abortController = options.abortController || createAbortController();
    this.initialize();
  }
  initialize() {
    try {
      const {
        additionalDirectories = [],
        agents,
        cwd,
        executable = isRunningWithBun() ? "bun" : "node",
        executableArgs = [],
        extraArgs = {},
        pathTonexusCodeExecutable,
        env = { ...process.env },
        stderr,
        customSystemPrompt,
        appendSystemPrompt,
        maxTurns,
        model,
        fallbackModel,
        permissionMode,
        permissionPromptToolName,
        continueConversation,
        resume,
        settingSources,
        allowedTools = [],
        disallowedTools = [],
        mcpServers,
        strictMcpConfig,
        canUseTool,
        includePartialMessages
      } = this.options;
      const args = [
        "--output-format",
        "stream-json",
        "--verbose",
        "--input-format",
        "stream-json"
      ];
      if (customSystemPrompt)
        args.push("--system-prompt", customSystemPrompt);
      if (appendSystemPrompt)
        args.push("--append-system-prompt", appendSystemPrompt);
      if (maxTurns)
        args.push("--max-turns", maxTurns.toString());
      if (model)
        args.push("--model", model);
      if (env.DEBUG)
        args.push("--debug-to-stderr");
      if (canUseTool) {
        if (permissionPromptToolName) {
          throw new Error("canUseTool callback cannot be used with permissionPromptToolName. Please use one or the other.");
        }
        args.push("--permission-prompt-tool", "stdio");
      } else if (permissionPromptToolName) {
        args.push("--permission-prompt-tool", permissionPromptToolName);
      }
      if (continueConversation)
        args.push("--continue");
      if (resume)
        args.push("--resume", resume);
      if (allowedTools.length > 0) {
        args.push("--allowedTools", allowedTools.join(","));
      }
      if (disallowedTools.length > 0) {
        args.push("--disallowedTools", disallowedTools.join(","));
      }
      if (mcpServers && Object.keys(mcpServers).length > 0) {
        args.push("--mcp-config", JSON.stringify({ mcpServers }));
      }
      if (agents && Object.keys(agents).length > 0) {
        args.push("--agents", JSON.stringify(agents));
      }
      if (settingSources && settingSources.length > 0) {
        args.push("--setting-sources", settingSources.join(","));
      }
      if (strictMcpConfig) {
        args.push("--strict-mcp-config");
      }
      if (permissionMode && permissionMode !== "default") {
        args.push("--permission-mode", permissionMode);
      }
      if (fallbackModel) {
        if (model && fallbackModel === model) {
          throw new Error("Fallback model cannot be the same as the main model. Please specify a different model for fallbackModel option.");
        }
        args.push("--fallback-model", fallbackModel);
      }
      if (includePartialMessages) {
        args.push("--include-partial-messages");
      }
      for (const dir of additionalDirectories) {
        args.push("--add-dir", dir);
      }
      if (this.options.forkSession) {
        args.push("--fork-session");
      }
      if (this.options.resumeSessionAt) {
        args.push("--resume-session-at", this.options.resumeSessionAt);
      }
      for (const [flag, value] of Object.entries(extraArgs)) {
        if (value === null) {
          args.push(`--${flag}`);
        } else {
          args.push(`--${flag}`, value);
        }
      }
      if (!env.nexus_CODE_ENTRYPOINT) {
        env.nexus_CODE_ENTRYPOINT = "sdk-ts";
      }
      const fs2 = getFsImplementation();
      if (!fs2.existsSync(pathTonexusCodeExecutable)) {
        const errorMessage = isNativeBinary(pathTonexusCodeExecutable) ? `Nexus Code native binary not found at ${pathTonexusCodeExecutable}. Please ensure Nexus Code is installed via native installer or specify a valid path with options.pathTonexusCodeExecutable.` : `Nexus Code executable not found at ${pathTonexusCodeExecutable}. Is options.pathTonexusCodeExecutable set?`;
        throw new ReferenceError(errorMessage);
      }
      const isNative = isNativeBinary(pathTonexusCodeExecutable);
      const spawnCommand = isNative ? pathTonexusCodeExecutable : executable;
      const spawnArgs = isNative ? args : [...executableArgs, pathTonexusCodeExecutable, ...args];
      this.logForDebugging(isNative ? `Spawning Nexus Code native binary: ${pathTonexusCodeExecutable} ${args.join(" ")}` : `Spawning Nexus Code process: ${executable} ${[...executableArgs, pathTonexusCodeExecutable, ...args].join(" ")}`);
      const stderrMode = env.DEBUG || stderr ? "pipe" : "ignore";
      this.child = spawn(spawnCommand, spawnArgs, {
        cwd,
        stdio: ["pipe", "pipe", stderrMode],
        signal: this.abortController.signal,
        env
      });
      this.childStdin = this.child.stdin;
      this.childStdout = this.child.stdout;
      if (env.DEBUG || stderr) {
        this.child.stderr.on("data", (data) => {
          this.logForDebugging(`Nexus Code stderr: ${data.toString()}`);
          if (stderr) {
            stderr(data.toString());
          }
        });
      }
      const cleanup = () => {
        if (this.child && !this.child.killed) {
          this.child.kill("SIGTERM");
        }
      };
      this.processExitHandler = cleanup;
      this.abortHandler = cleanup;
      process.on("exit", this.processExitHandler);
      this.abortController.signal.addEventListener("abort", this.abortHandler);
      this.child.on("error", (error) => {
        this.ready = false;
        if (this.abortController.signal.aborted) {
          this.exitError = new AbortError("Nexus Code process aborted by user");
        } else {
          this.exitError = new Error(`Failed to spawn Nexus Code process: ${error.message}`);
          this.logForDebugging(this.exitError.message);
        }
      });
      this.child.on("close", (code, signal) => {
        this.ready = false;
        if (this.abortController.signal.aborted) {
          this.exitError = new AbortError("Nexus Code process aborted by user");
        } else {
          const error = this.getProcessExitError(code, signal);
          if (error) {
            this.exitError = error;
            this.logForDebugging(error.message);
          }
        }
      });
      this.ready = true;
    } catch (error) {
      this.ready = false;
      throw error;
    }
  }
  getProcessExitError(code, signal) {
    if (code !== 0 && code !== null) {
      return new Error(`Nexus Code process exited with code ${code}`);
    } else if (signal) {
      return new Error(`Nexus Code process terminated by signal ${signal}`);
    }
    return;
  }
  logForDebugging(message) {
    if (process.env.DEBUG) {
      process.stderr.write(`${message}
`);
    }
    if (this.options.stderr) {
      this.options.stderr(message);
    }
  }
  write(data) {
    if (this.abortController.signal.aborted) {
      throw new AbortError("Operation aborted");
    }
    if (!this.ready || !this.childStdin) {
      throw new Error("ProcessTransport is not ready for writing");
    }
    if (this.child?.killed || this.child?.exitCode !== null) {
      throw new Error("Cannot write to terminated process");
    }
    if (this.exitError) {
      throw new Error(`Cannot write to process that exited with error: ${this.exitError.message}`);
    }
    if (process.env.DEBUG_SDK) {
      process.stderr.write(`[ProcessTransport] Writing to stdin: ${data.substring(0, 100)}
`);
    }
    try {
      const written = this.childStdin.write(data);
      if (!written && process.env.DEBUG_SDK) {
        console.warn("[ProcessTransport] Write buffer full, data queued");
      }
    } catch (error) {
      this.ready = false;
      throw new Error(`Failed to write to process stdin: ${error.message}`);
    }
  }
  close() {
    if (this.childStdin) {
      this.childStdin.end();
      this.childStdin = undefined;
    }
    if (this.processExitHandler) {
      process.off("exit", this.processExitHandler);
      this.processExitHandler = undefined;
    }
    if (this.abortHandler) {
      this.abortController.signal.removeEventListener("abort", this.abortHandler);
      this.abortHandler = undefined;
    }
    for (const { handler } of this.exitListeners) {
      this.child?.off("exit", handler);
    }
    this.exitListeners = [];
    if (this.child && !this.child.killed) {
      this.child.kill("SIGTERM");
      setTimeout(() => {
        if (this.child && !this.child.killed) {
          this.child.kill("SIGKILL");
        }
      }, 5000);
    }
    this.ready = false;
  }
  isReady() {
    return this.ready;
  }
  async* readMessages() {
    if (!this.childStdout) {
      throw new Error("ProcessTransport output stream not available");
    }
    const rl = createInterface({ input: this.childStdout });
    try {
      for await (const line of rl) {
        if (line.trim()) {
          const message = JSON.parse(line);
          yield message;
        }
      }
      await this.waitForExit();
    } catch (error) {
      throw error;
    } finally {
      rl.close();
    }
  }
  endInput() {
    if (this.childStdin) {
      this.childStdin.end();
    }
  }
  getInputStream() {
    return this.childStdin;
  }
  onExit(callback) {
    if (!this.child)
      return () => {};
    const handler = (code, signal) => {
      const error = this.getProcessExitError(code, signal);
      callback(error);
    };
    this.child.on("exit", handler);
    this.exitListeners.push({ callback, handler });
    return () => {
      if (this.child) {
        this.child.off("exit", handler);
      }
      const index = this.exitListeners.findIndex((l) => l.handler === handler);
      if (index !== -1) {
        this.exitListeners.splice(index, 1);
      }
    };
  }
  async waitForExit() {
    if (!this.child) {
      if (this.exitError) {
        throw this.exitError;
      }
      return;
    }
    if (this.child.exitCode !== null || this.child.killed) {
      if (this.exitError) {
        throw this.exitError;
      }
      return;
    }
    return new Promise((resolve, reject) => {
      const exitHandler = (code, signal) => {
        if (this.abortController.signal.aborted) {
          reject(new AbortError("Operation aborted"));
          return;
        }
        const error = this.getProcessExitError(code, signal);
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      };
      this.child.once("exit", exitHandler);
      const errorHandler = (error) => {
        this.child.off("exit", exitHandler);
        reject(error);
      };
      this.child.once("error", errorHandler);
      this.child.once("exit", () => {
        this.child.off("error", errorHandler);
      });
    });
  }
}
function isNativeBinary(executablePath) {
  const jsExtensions = [".js", ".mjs", ".tsx", ".ts", ".jsx"];
  return !jsExtensions.some((ext) => executablePath.endsWith(ext));
}
