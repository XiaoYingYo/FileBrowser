package com.XiaoYing.handler;

import com.XiaoYing.model.TerminalSession;
import com.XiaoYing.service.TerminalSessionManager;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.BufferedWriter;
import java.io.IOException;
import java.net.URI;
import java.util.HashMap;
import java.util.Map;

@Component
public class TerminalWebSocketHandler extends TextWebSocketHandler {
    @Autowired
    private TerminalSessionManager sessionManager;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        URI uri = session.getUri();
        if (uri == null) {
            session.close(CloseStatus.BAD_DATA);
            return;
        }

        Map<String, String> params = parseQueryString(uri.getQuery());
        String terminalType = params.getOrDefault("type", "cmd");
        String workingDirectory = params.get("path");

        String sessionId = session.getId();

        try {
            sessionManager.createSession(sessionId, session, terminalType, workingDirectory);
        } catch (IOException e) {
            System.err.println("创建终端会话失败: " + e.getMessage());
            session.close(CloseStatus.SERVER_ERROR);
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String sessionId = session.getId();
        String payload = message.getPayload();
        try {
            Map<String, Object> msg = objectMapper.readValue(payload, Map.class);
            String type = (String) msg.get("type");
            if ("ping".equals(type)) {
                Map<String, String> response = new HashMap<>();
                response.put("type", "pong");
                session.sendMessage(new TextMessage(objectMapper.writeValueAsString(response)));
                return;
            }
            if ("interrupt".equals(type)) {
                TerminalSession terminalSession = sessionManager.getSession(sessionId);
                if (terminalSession != null) {
                    sessionManager.interruptSession(sessionId);
                }
                return;
            }
            if ("command".equals(type)) {
                TerminalSession terminalSession = sessionManager.getSession(sessionId);
                if (terminalSession == null) {
                    return;
                }
                String command = (String) msg.get("data");
                BufferedWriter processInput = terminalSession.getProcessInput();
                try {
                    processInput.write(command);
                    processInput.flush();
                } catch (IOException e) {
                    System.err.println("写入进程输入时出错: " + e.getMessage());
                }
            }
        } catch (Exception e) {
            System.err.println("处理WebSocket消息时出错: " + e.getMessage());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String sessionId = session.getId();
        sessionManager.closeSession(sessionId);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        System.err.println("WebSocket传输错误: " + exception.getMessage());
        String sessionId = session.getId();
        sessionManager.closeSession(sessionId);
    }

    private Map<String, String> parseQueryString(String query) {
        Map<String, String> params = new HashMap<>();
        if (query == null || query.isEmpty()) {
            return params;
        }

        String[] pairs = query.split("&");
        for (String pair : pairs) {
            int idx = pair.indexOf("=");
            if (idx > 0) {
                String key = pair.substring(0, idx);
                String value = pair.substring(idx + 1);
                try {
                    value = java.net.URLDecoder.decode(value, "UTF-8");
                } catch (Exception e) {
                }
                params.put(key, value);
            }
        }
        return params;
    }
}