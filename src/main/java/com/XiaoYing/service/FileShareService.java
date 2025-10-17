package com.XiaoYing.service;

import com.XiaoYing.model.ShareInfo;
import org.springframework.stereotype.Service;

import java.io.File;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class FileShareService {
    private final ConcurrentHashMap<String, ShareInfo> shareMap = new ConcurrentHashMap<>();

    public String createShare(String filePath, String username) {
        File file = new File(filePath);
        if (!file.exists() || !file.isFile()) {
            throw new IllegalArgumentException("文件不存在或不是文件");
        }
        String token = UUID.randomUUID().toString().replace("-", "");
        String fileName = Paths.get(filePath).getFileName().toString();
        ShareInfo shareInfo = new ShareInfo(token, filePath, fileName, username);
        shareMap.put(token, shareInfo);
        return token;
    }

    public ShareInfo getShareInfo(String token) {
        return shareMap.get(token);
    }

    public boolean deleteShare(String token) {
        return shareMap.remove(token) != null;
    }

    public List<ShareInfo> listUserShares(String username) {
        return shareMap.values().stream()
                .filter(share -> share.getCreator().equals(username))
                .collect(Collectors.toList());
    }
}