package com.XiaoYing.controller;

import com.XiaoYing.service.FileShareService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import javax.swing.filechooser.FileSystemView;
import java.io.File;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

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
    @Autowired
    private FileShareService fileShareService;
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
    private final Map<String, Map<String, Object>> scheduledDeletions = new ConcurrentHashMap<>();
    private final Set<String> pendingDeletions = Collections.newSetFromMap(new ConcurrentHashMap<>());

    @GetMapping("/files")
    public Map<String, List<Map<String, Object>>> getFiles(@RequestParam("path") String pathStr) {
        List<Map<String, Object>> directories = new ArrayList<>();
        List<Map<String, Object>> files = new ArrayList<>();
        Path directory = Paths.get(pathStr);
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(directory)) {
            for (Path file : stream) {
                if (pendingDeletions.contains(file.toAbsolutePath().toString())) {
                    continue;
                }
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
                Map<String, Object> diskInfo = new HashMap<>();
                diskInfo.put("path", root.getAbsolutePath());
                diskInfo.put("type", typeDescription);
                diskInfo.put("totalSpace", root.getTotalSpace());
                diskInfo.put("freeSpace", root.getFreeSpace());
                diskInfo.put("usableSpace", root.getUsableSpace());
                disks.add(diskInfo);
            }
        }
        return disks;
    }

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
                    String undoId = UUID.randomUUID().toString();
                    pendingDeletions.addAll(pathsToDelete); // Add paths to pending set
                    Runnable deleteAction = () -> {
                        try {
                            for (String pathStr : pathsToDelete) {
                                Path path = Paths.get(pathStr);
                                if (Files.isDirectory(path)) {
                                    Files.walk(path).sorted(Comparator.reverseOrder()).map(Path::toFile).forEach(File::delete);
                                } else {
                                    Files.delete(path);
                                }
                            }
                        } catch (Throwable e) {
                            e.printStackTrace();
                        } finally {
                            scheduledDeletions.remove(undoId);
                            pendingDeletions.removeAll(pathsToDelete);
                        }
                    };
                    ScheduledFuture<?> scheduledFuture = scheduler.schedule(deleteAction, 1, TimeUnit.MINUTES);
                    Map<String, Object> deletionInfo = new HashMap<>();
                    deletionInfo.put("future", scheduledFuture);
                    deletionInfo.put("paths", pathsToDelete);
                    scheduledDeletions.put(undoId, deletionInfo);
                    response.put("undoId", undoId);
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
                case "create":
                    String pathStr = (String) payload.get("path");
                    String name = (String) payload.get("name");
                    String type = (String) payload.get("type");
                    Path parentDir = Paths.get(pathStr);
                    Path newPath = parentDir.resolve(name);
                    if ("file".equals(type)) {
                        Files.createFile(newPath);
                    } else {
                        Files.createDirectory(newPath);
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

    @PostMapping("/undo-delete")
    public Map<String, Object> undoDelete(@RequestBody Map<String, Object> payload) {
        String undoId = (String) payload.get("undoId");
        Map<String, Object> response = new HashMap<>();
        Map<String, Object> deletionInfo = scheduledDeletions.get(undoId);
        if (deletionInfo != null) {
            ScheduledFuture<?> scheduledFuture = (ScheduledFuture<?>) deletionInfo.get("future");
            boolean cancelled = scheduledFuture.cancel(false);
            if (cancelled) {
                scheduledDeletions.remove(undoId);
                List<String> pathsToRestore = (List<String>) deletionInfo.get("paths");
                if (pathsToRestore != null) {
                    pendingDeletions.removeAll(pathsToRestore);
                }
                response.put("success", true);
                response.put("message", "Deletion has been cancelled.");
            } else {
                response.put("success", false);
                response.put("error", "Could not cancel deletion. It may have already been completed.");
            }
        } else {
            response.put("success", true);
            response.put("message", "Deletion task not found, it might have been already executed or cancelled.");
        }
        return response;
    }

    @PostMapping("/share/create")
    public Map<String, Object> createShare(@RequestBody Map<String, String> request, Authentication authentication, HttpServletRequest httpRequest) {
        Map<String, Object> response = new HashMap<>();
        try {
            String filePath = request.get("filePath");
            String username = authentication.getName();
            String token = fileShareService.createShare(filePath, username);
            String scheme = httpRequest.getScheme();
            String serverName = httpRequest.getServerName();
            int serverPort = httpRequest.getServerPort();
            String contextPath = httpRequest.getContextPath();
            String baseUrl = scheme + "://" + serverName + (serverPort == 80 || serverPort == 443 ? "" : ":" + serverPort) + contextPath;
            String shareUrl = baseUrl + "/share/download/" + token;
            response.put("success", true);
            response.put("shareUrl", shareUrl);
            response.put("token", token);
        } catch (Exception e) {
            response.put("success", false);
            response.put("error", e.getMessage());
        }
        return response;
    }

    @DeleteMapping("/share/{token}")
    public Map<String, Object> deleteShare(@PathVariable String token) {
        Map<String, Object> response = new HashMap<>();
        boolean deleted = fileShareService.deleteShare(token);
        response.put("success", deleted);
        if (!deleted) {
            response.put("message", "分享不存在或已被删除");
        }
        return response;
    }
}