package com.XiaoYing.config;
import com.XiaoYing.model.UserConfig;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
@Component
public class UserConfigLoader {
    private static final String CONFIG_FILE = "config.json";
    private final ObjectMapper objectMapper = new ObjectMapper();
    public List<UserConfig> loadUsers() {
        List<UserConfig> users = new ArrayList<>();
        File configFile = new File(CONFIG_FILE);
        if (!configFile.exists()) {
            return users;
        }
        try {
            JsonNode root = objectMapper.readTree(configFile);
            JsonNode usersNode = root.get("users");
            if (usersNode != null && usersNode.isArray()) {
                for (JsonNode userNode : usersNode) {
                    UserConfig user = objectMapper.treeToValue(userNode, UserConfig.class);
                    users.add(user);
                }
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
        return users;
    }
}