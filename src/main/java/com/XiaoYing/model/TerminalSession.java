package com.XiaoYing.model;

import org.springframework.web.socket.WebSocketSession;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;

public class TerminalSession {
    private final String sessionId;
    private final WebSocketSession webSocketSession;
    private final Process process;
    private final BufferedWriter processInput;
    private final BufferedReader processOutput;
    private final BufferedReader processError;
    private final Thread outputReaderThread;
    private final Thread errorReaderThread;

    public TerminalSession(String sessionId, WebSocketSession webSocketSession, Process process,
                          BufferedWriter processInput, BufferedReader processOutput,
                          BufferedReader processError, Thread outputReaderThread,
                          Thread errorReaderThread) {
        this.sessionId = sessionId;
        this.webSocketSession = webSocketSession;
        this.process = process;
        this.processInput = processInput;
        this.processOutput = processOutput;
        this.processError = processError;
        this.outputReaderThread = outputReaderThread;
        this.errorReaderThread = errorReaderThread;
    }

    public String getSessionId() {
        return sessionId;
    }

    public WebSocketSession getWebSocketSession() {
        return webSocketSession;
    }

    public Process getProcess() {
        return process;
    }

    public BufferedWriter getProcessInput() {
        return processInput;
    }

    public BufferedReader getProcessOutput() {
        return processOutput;
    }

    public BufferedReader getProcessError() {
        return processError;
    }

    public Thread getOutputReaderThread() {
        return outputReaderThread;
    }

    public Thread getErrorReaderThread() {
        return errorReaderThread;
    }

    public void cleanup() {
        try {
            if (outputReaderThread != null && outputReaderThread.isAlive()) {
                outputReaderThread.interrupt();
            }
            if (errorReaderThread != null && errorReaderThread.isAlive()) {
                errorReaderThread.interrupt();
            }
            if (processInput != null) {
                processInput.close();
            }
            if (processOutput != null) {
                processOutput.close();
            }
            if (processError != null) {
                processError.close();
            }
            if (process != null && process.isAlive()) {
                process.destroyForcibly();
            }
        } catch (IOException e) {
            System.err.println("清理终端会话时出错: " + e.getMessage());
        }
    }
}