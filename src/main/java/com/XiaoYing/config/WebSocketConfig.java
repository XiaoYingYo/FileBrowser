package com.XiaoYing.config;

import com.XiaoYing.handler.TerminalWebSocketHandler;
import com.XiaoYing.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {
    @Autowired
    private TerminalWebSocketHandler terminalWebSocketHandler;

    @Autowired
    private JwtUtil jwtUtil;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(terminalWebSocketHandler, "/ws/terminal").addInterceptors(new JwtHandshakeInterceptor(jwtUtil)).setAllowedOrigins("*");
    }

    private static class JwtHandshakeInterceptor implements HandshakeInterceptor {
        private final JwtUtil jwtUtil;

        public JwtHandshakeInterceptor(JwtUtil jwtUtil) {
            this.jwtUtil = jwtUtil;
        }

        @Override
        public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                      WebSocketHandler wsHandler, Map<String, Object> attributes) throws Exception {
            String query = request.getURI().getQuery();
            if (query == null) {
                return false;
            }
            String token = null;
            String[] pairs = query.split("&");
            for (String pair : pairs) {
                if (pair.startsWith("token=")) {
                    token = pair.substring(6);
                    break;
                }
            }
            if (token == null || token.isEmpty()) {
                return false;
            }
            try {
                String username = jwtUtil.extractUsername(token);
                attributes.put("username", username);
                return true;
            } catch (Exception e) {
                System.err.println("JWT解析失败: " + e.getMessage());
                return false;
            }
        }

        @Override
        public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler, Exception exception) {
        }
    }
}