package com.XiaoYing.service;
import com.XiaoYing.config.UserConfigLoader;
import com.XiaoYing.model.UserConfig;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
@Service
public class UserService implements UserDetailsService {
    private final Map<String, String> users = new HashMap<>();
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    @Autowired
    public UserService(UserConfigLoader userConfigLoader) {
        List<UserConfig> userConfigs = userConfigLoader.loadUsers();
        for (UserConfig userConfig : userConfigs) {
            users.put(userConfig.getUsername(), passwordEncoder.encode(userConfig.getPassword()));
        }
    }
    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        String password = users.get(username);
        if (password == null) {
            throw new UsernameNotFoundException("用户不存在: " + username);
        }
        return new User(username, password, new ArrayList<>());
    }
    public boolean userExists(String username) {
        return users.containsKey(username);
    }
}