package com.XiaoYing.controller;

import org.springframework.web.bind.annotation.*;

import javax.swing.filechooser.FileSystemView;
import java.io.File;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Date;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ApiController {
    @GetMapping("/files")
    public Map<String, List<Map<String, Object>>> getFiles(@RequestParam("path") String pathStr) {
        List<Map<String, Object>> directories = new ArrayList<>();
        List<Map<String, Object>> files = new ArrayList<>();
        Path directory = Paths.get(pathStr);
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(directory)) {
            for (Path file : stream) {
                Map<String, Object> fileInfo = new HashMap<>();
                fileInfo.put("name", file.getFileName().toString());
                fileInfo.put("path", file.toAbsolutePath().toString());
                boolean isDirectory = Files.isDirectory(file);
                fileInfo.put("isDirectory", isDirectory);
                fileInfo.put("isSymbolicLink", Files.isSymbolicLink(file));
                fileInfo.put("isHidden", Files.isHidden(file));
                try {
                    fileInfo.put("lastModified", new Date(Files.getLastModifiedTime(file).toMillis()));
                } catch (Throwable e) {
                    fileInfo.put("lastModified", new Date(0));
                }
                if (isDirectory) {
                    fileInfo.put("size", 0L);
                    directories.add(fileInfo);
                } else {
                    fileInfo.put("size", Files.size(file));
                    files.add(fileInfo);
                }
            }
        } catch (Throwable e) {
            e.printStackTrace();
        }

        Map<String, List<Map<String, Object>>> result = new HashMap<>();
        result.put("directories", directories);
        result.put("files", files);
        return result;
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

    // 为标签页打开cmd或powershell 返回唯一命令提示符标识 接受JSON BODY
    @RequestMapping(value = "/openTerminal", method = {RequestMethod.POST})
    public String openTerminal(@RequestBody Map<String, String> requestBody) {
        String path = requestBody.get("path");
        String type = requestBody.get("type");
        return "";
    }
    @PostMapping("/fs-operation")
    public Map<String, Object> fsOperation(@RequestBody Map<String, Object> payload) throws IOException {
        String action = (String) payload.get("action");
        Map<String, Object> response = new HashMap<>();
        try {
            switch (action) {
                case "delete":
                    List<String> pathsToDelete = (List<String>) payload.get("paths");
                    for (String pathStr : pathsToDelete) {
                        Path path = Paths.get(pathStr);
                        if (Files.isDirectory(path)) {
                            Files.walk(path)
                                    .sorted(Comparator.reverseOrder())
                                    .map(Path::toFile)
                                    .forEach(File::delete);
                        } else {
                            Files.delete(path);
                        }
                    }
                    break;
                case "rename":
                    String oldPathStr = (String) payload.get("oldPath");
                    String newName = (String) payload.get("newName");
                    Path oldPath = Paths.get(oldPathStr);
                    Files.move(oldPath, oldPath.resolveSibling(newName));
                    break;
                case "paste":
                    List<String> sourcePaths = (List<String>) payload.get("sourcePaths");
                    String destinationPath = (String) payload.get("destinationPath");
                    String operation = (String) payload.get("operation");
                    Path destDir = Paths.get(destinationPath);
                    for (String sourcePathStr : sourcePaths) {
                        Path sourcePath = Paths.get(sourcePathStr);
                        Path destPath = destDir.resolve(sourcePath.getFileName());
                        if ("cut".equals(operation)) {
                            Files.move(sourcePath, destPath, StandardCopyOption.REPLACE_EXISTING);
                        } else {
                            Files.copy(sourcePath, destPath, StandardCopyOption.REPLACE_EXISTING);
                        }
                    }
                    break;
                default:
                    throw new IllegalArgumentException("Unknown action: " + action);
            }
            response.put("success", true);
        } catch (Exception e) {
            response.put("success", false);
            response.put("error", e.getMessage());
        }
        return response;
    }
}