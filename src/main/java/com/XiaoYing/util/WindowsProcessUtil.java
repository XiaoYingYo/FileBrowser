package com.XiaoYing.util;

import com.sun.jna.Native;
import com.sun.jna.Platform;
import com.sun.jna.Pointer;
import com.sun.jna.platform.win32.Kernel32;
import com.sun.jna.platform.win32.WinNT;
import com.sun.jna.win32.StdCallLibrary;

public class WindowsProcessUtil {
    public interface Kernel32Extended extends StdCallLibrary, Kernel32 {
        Kernel32Extended INSTANCE = Native.load("kernel32", Kernel32Extended.class);
        boolean GenerateConsoleCtrlEvent(int dwCtrlEvent, int dwProcessGroupId);
        boolean AttachConsole(int dwProcessId);
        boolean FreeConsole();
        boolean SetConsoleCtrlHandler(Pointer handlerRoutine, boolean add);
        int GetProcessId(WinNT.HANDLE process);
    }
    private static final int CTRL_C_EVENT = 0;
    private static final int CTRL_BREAK_EVENT = 1;

    public static long getProcessIdFromHandle(long handleValue) {
        if (!Platform.isWindows()) {
            return -1;
        }
        try {
            WinNT.HANDLE handle = new WinNT.HANDLE(new Pointer(handleValue));
            return Kernel32Extended.INSTANCE.GetProcessId(handle);
        } catch (Exception e) {
            System.err.println("从句柄获取进程ID失败: " + e.getMessage());
            return -1;
        }
    }
    public static boolean sendCtrlC(long pid) {
        if (!Platform.isWindows()) {
            return false;
        }
        try {
            int processId = (int) pid;
            Kernel32Extended kernel32 = Kernel32Extended.INSTANCE;
            kernel32.FreeConsole();
            if (!kernel32.AttachConsole(processId)) {
                System.err.println("无法附加到进程控制台: PID=" + processId);
                return false;
            }
            kernel32.SetConsoleCtrlHandler(null, true);
            try {
                Thread.sleep(50);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
            }
            boolean result = kernel32.GenerateConsoleCtrlEvent(CTRL_C_EVENT, 0);
            System.out.println("发送Ctrl+C信号到进程组, 结果: " + result);
            try {
                Thread.sleep(50);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
            }
            kernel32.SetConsoleCtrlHandler(null, false);
            kernel32.FreeConsole();
            return result;
        } catch (Exception e) {
            System.err.println("发送Ctrl+C信号失败: " + e.getMessage());
            e.printStackTrace();
            try {
                Kernel32Extended.INSTANCE.FreeConsole();
            } catch (Exception ex) {
            }
            return false;
        }
    }
    public static boolean sendCtrlBreak(long pid) {
        if (!Platform.isWindows()) {
            return false;
        }
        try {
            int processId = (int) pid;
            Kernel32Extended kernel32 = Kernel32Extended.INSTANCE;
            kernel32.FreeConsole();
            if (!kernel32.AttachConsole(processId)) {
                return false;
            }
            kernel32.SetConsoleCtrlHandler(null, true);
            boolean result = kernel32.GenerateConsoleCtrlEvent(CTRL_BREAK_EVENT, 0);
            kernel32.FreeConsole();
            kernel32.SetConsoleCtrlHandler(null, false);
            return result;
        } catch (Exception e) {
            System.err.println("发送Ctrl+Break信号失败: " + e.getMessage());
            return false;
        }
    }
}