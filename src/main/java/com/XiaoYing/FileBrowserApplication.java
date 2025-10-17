package com.XiaoYing;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class FileBrowserApplication {
    public static void main(String[] args) {
        System.out.println("http://127.0.0.1:2666/");
        SpringApplication.run(FileBrowserApplication.class, args);
    }
}