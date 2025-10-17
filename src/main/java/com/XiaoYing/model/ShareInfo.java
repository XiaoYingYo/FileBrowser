package com.XiaoYing.model;

import java.time.LocalDateTime;

public class ShareInfo {
    private String token;
    private String filePath;
    private String fileName;
    private String creator;
    private LocalDateTime createTime;

    public ShareInfo() {
    }

    public ShareInfo(String token, String filePath, String fileName, String creator) {
        this.token = token;
        this.filePath = filePath;
        this.fileName = fileName;
        this.creator = creator;
        this.createTime = LocalDateTime.now();
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public String getFilePath() {
        return filePath;
    }

    public void setFilePath(String filePath) {
        this.filePath = filePath;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getCreator() {
        return creator;
    }

    public void setCreator(String creator) {
        this.creator = creator;
    }

    public LocalDateTime getCreateTime() {
        return createTime;
    }

    public void setCreateTime(LocalDateTime createTime) {
        this.createTime = createTime;
    }
}