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
            ShareInfo shareInfo = fileShareService.getShareInfo(token);
            if (shareInfo == null) {
                return ResponseEntity.notFound().build();
            }
            File file = new File(shareInfo.getFilePath());
            if (!file.exists() || !file.isFile()) {
                return ResponseEntity.notFound().build();
            }
            long fileLength = file.length();
            String fileName;
            try {
                fileName = URLEncoder.encode(shareInfo.getFileName(), StandardCharsets.UTF_8.name());
            } catch (UnsupportedEncodingException e) {
                fileName = shareInfo.getFileName();
            }
            Resource resource = new FileSystemResource(file);
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