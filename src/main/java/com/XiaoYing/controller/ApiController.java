package com.XiaoYing.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import javax.swing.filechooser.FileSystemView;
import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;
import org.springframework.web.bind.annotation.RequestParam;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Date;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ApiController {
    @GetMapping("/files")
    public List<Map<String, Object>> getFiles(@RequestParam("path") String pathStr) {
        List<Map<String, Object>> files = new ArrayList<>();
        Path directory = Paths.get(pathStr);
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(directory)) {
            for (Path file : stream) {
                Map<String, Object> fileInfo = new HashMap<>();
                fileInfo.put("name", file.getFileName().toString());
                fileInfo.put("path", file.toAbsolutePath().toString());
                fileInfo.put("isDirectory", Files.isDirectory(file));
                // Add properties for symbolic links and hidden files
                fileInfo.put("isSymbolicLink", Files.isSymbolicLink(file));
                fileInfo.put("isHidden", Files.isHidden(file));
                try {
                    fileInfo.put("size", Files.size(file));
                    fileInfo.put("lastModified", new Date(Files.getLastModifiedTime(file).toMillis()));
                } catch (IOException e) {
                    // Handle cases where attributes cannot be read (e.g., broken links)
                    fileInfo.put("size", 0L);
                    fileInfo.put("lastModified", new Date(0));
                }
                files.add(fileInfo);
            }
        } catch (IOException e) {
            // Log or handle the exception appropriately
            e.printStackTrace();
        }
        return files;
    }
    
    @GetMapping("/disks")
    public List<Map<String, Object>> getDisks() {
        List<Map<String, Object>> disks = new ArrayList<>();
        FileSystemView fsv = FileSystemView.getFileSystemView();
        File[] roots = File.listRoots();
        for (File root : roots) {
            if (fsv.isDrive(root) && !fsv.isFloppyDrive(root) && root.canRead() && root.getTotalSpace() > 0) {
                String typeDescription = fsv.getSystemTypeDescription(root);
                if (typeDescription != null && (typeDescription.contains("Local Disk") || typeDescription.contains("本地磁盘"))) {
                    Map<String, Object> diskInfo = new HashMap<>();
                    diskInfo.put("path", root.getAbsolutePath());
                    diskInfo.put("type", typeDescription);
                    diskInfo.put("totalSpace", root.getTotalSpace());
                    diskInfo.put("freeSpace", root.getFreeSpace());
                    diskInfo.put("usableSpace", root.getUsableSpace());
                    disks.add(diskInfo);
                }
            }
        }
        return disks;
    }
}