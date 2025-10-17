package com.XiaoYing.controller;

import com.XiaoYing.model.ShareInfo;
import com.XiaoYing.service.FileShareService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.io.File;
import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@RestController
public class ShareController {
    @Autowired
    private FileShareService fileShareService;

    @GetMapping("/share/download/{token}")
    public ResponseEntity<Resource> download(
            @PathVariable String token,
            @RequestHeader(value = "Range", required = false) String rangeHeader) {
        try {
            System.out.println("下载请求: token=" + token + ", Range=" + rangeHeader);
            ShareInfo shareInfo = fileShareService.getShareInfo(token);
            if (shareInfo == null) {
                System.out.println("分享信息未找到: " + token);
                return ResponseEntity.notFound().build();
            }
            System.out.println("找到分享: " + shareInfo.getFilePath());
            File file = new File(shareInfo.getFilePath());
            if (!file.exists() || !file.isFile()) {
                System.out.println("文件不存在: " + shareInfo.getFilePath());
                return ResponseEntity.notFound().build();
            }
            long fileLength = file.length();
            System.out.println("文件大小: " + fileLength);
            String fileName;
            try {
                fileName = URLEncoder.encode(shareInfo.getFileName(), StandardCharsets.UTF_8.name());
            } catch (UnsupportedEncodingException e) {
                fileName = shareInfo.getFileName();
            }
            Resource resource = new FileSystemResource(file);
            System.out.println("返回完整文件,大小: " + fileLength);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .contentLength(fileLength)
                    .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                    .body(resource);
        } catch (Exception e) {
            System.err.println("下载处理失败:");
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }
}