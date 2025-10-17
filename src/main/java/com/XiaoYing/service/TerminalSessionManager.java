package com.XiaoYing.service;

import com.XiaoYing.model.TerminalSession;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.*;
import java.nio.charset.Charset;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class TerminalSessionManager {
    private final Map<String, TerminalSession> sessions = new ConcurrentHashMap<>();

    public TerminalSession createSession(String sessionId, WebSocketSession webSocketSession,
                                        String terminalType, String workingDirectory) throws IOException {
        String command;
        if ("powershell".equalsIgnoreCase(terminalType) || "ps".equalsIgnoreCase(terminalType)) {
            command = "powershell.exe";
        } else {
            command = "cmd.exe";
        }

        ProcessBuilder processBuilder = new ProcessBuilder(command);
        if (workingDirectory != null && !workingDirectory.isEmpty()) {
            processBuilder.directory(new File(workingDirectory));
        }
        processBuilder.redirectErrorStream(false);

        Process process = processBuilder.start();

        Charset charset = Charset.forName("GBK");
        BufferedWriter processInput = new BufferedWriter(
            new OutputStreamWriter(process.getOutputStream(), charset)
        );
        BufferedReader processOutput = new BufferedReader(
            new InputStreamReader(process.getInputStream(), charset)
        );
        BufferedReader processError = new BufferedReader(
            new InputStreamReader(process.getErrorStream(), charset)
        );

        Thread outputThread = new Thread(() -> readAndSendOutput(webSocketSession, processOutput, false));
        outputThread.setDaemon(true);
        outputThread.start();

        Thread errorThread = new Thread(() -> readAndSendOutput(webSocketSession, processError, true));
        errorThread.setDaemon(true);
        errorThread.start();

        TerminalSession terminalSession = new TerminalSession(
            sessionId, webSocketSession, process, processInput,
            processOutput, processError, outputThread, errorThread
        );

        sessions.put(sessionId, terminalSession);
        return terminalSession;
    }

    private void readAndSendOutput(WebSocketSession webSocketSession, BufferedReader reader, boolean isError) {
        try {
            char[] buffer = new char[1024];
            int bytesRead;
            while ((bytesRead = reader.read(buffer)) != -1) {
                String output = new String(buffer, 0, bytesRead);
                if (webSocketSession.isOpen()) {
                    synchronized (webSocketSession) {
                        webSocketSession.sendMessage(new TextMessage(output));
                    }
                }
            }
        } catch (IOException e) {
            if (!e.getMessage().contains("Stream closed") && !e.getMessage().contains("Pipe closed")) {
                System.err.println("读取进程输出时出错: " + e.getMessage());
            }
        }
    }

    public TerminalSession getSession(String sessionId) {
        return sessions.get(sessionId);
    }

    public void closeSession(String sessionId) {
        TerminalSession session = sessions.remove(sessionId);
        if (session != null) {
            session.cleanup();
        }
    }

    public void closeAllSessionsForWebSocket(WebSocketSession webSocketSession) {
        sessions.entrySet().removeIf(entry -> {
            if (entry.getValue().getWebSocketSession().equals(webSocketSession)) {
                entry.getValue().cleanup();
                return true;
            }
            return false;
        });
    }
}