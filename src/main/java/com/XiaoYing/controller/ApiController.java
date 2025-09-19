package com.XiaoYing.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import javax.swing.filechooser.FileSystemView;
import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ApiController {
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