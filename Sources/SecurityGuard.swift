import Foundation
import UIKit
import Darwin

/// Module bảo vệ ứng dụng: chống dịch ngược, chống đính kèm debugger, phát hiện hooking / jailbreak
enum SecurityGuard {
    
    /// Kích hoạt toàn bộ các lớp phòng thủ khi khởi động app
    static func activate() {
        #if !DEBUG
        preventDebuggerAttachment()
        detectJailbreakAndTampering()
        #endif
    }
    
    // MARK: - 1. Chống đính kèm Debugger (Anti-Debugging via ptrace)
    private static func preventDebuggerAttachment() {
        // PT_DENY_ATTACH = 31: từ chối mọi debugger (lldb, gdb, frida-server) đính kèm vào process
        typealias PtraceType = @convention(c) (CInt, pid_t, CInt, CInt) -> CInt
        let handle = dlopen(nil, RTLD_GLOBAL | RTLD_NOW)
        if let sym = dlsym(handle, "ptrace") {
            let ptrace = unsafeBitCast(sym, to: PtraceType.self)
            _ = ptrace(31, 0, 0, 0)
        }
        
        // Kiểm tra cờ P_TRACED trong proc_info bằng sysctl
        var info = kinfo_proc()
        var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()]
        var size = MemoryLayout<kinfo_proc>.stride
        let junk = sysctl(&mib, UInt32(mib.count), &info, &size, nil, 0)
        if junk == 0 && (info.kp_proc.p_flag & P_TRACED) != 0 {
            NSLog("Aether: Warning - Process is being traced by an external tool.")
        }
    }
    
    // MARK: - 2. Phát hiện can thiệp hệ thống / Jailbreak / Dynamic Hooking
    private static func detectJailbreakAndTampering() {
        let suspiciousPaths = [
            "/Applications/Cydia.app",
            "/Library/MobileSubstrate/MobileSubstrate.dylib",
            "/bin/bash",
            "/usr/sbin/sshd",
            "/etc/apt",
            "/usr/bin/ssh",
            "/Library/MobileSubstrate/DynamicLibraries/FridaLoader.dylib"
        ]
        
        for path in suspiciousPaths {
            if FileManager.default.fileExists(atPath: path) {
                NSLog("Aether: Warning - Tampered environment detected.")
                break
            }
        }
        
        // Kiểm tra sandbox write test
        let testString = "AetherIntegrityTest"
        let testPath = "/private/aether_test_\(UUID().uuidString).txt"
        do {
            try testString.write(toFile: testPath, atomically: true, encoding: .utf8)
            try? FileManager.default.removeItem(atPath: testPath)
            // Nếu ghi được ra ngoài sandbox /private -> môi trường đã bị can thiệp
            NSLog("Aether: Warning - Sandbox violation.")
        } catch {
            // Đúng chuẩn: ghi ngoài sandbox phải fail
        }
    }
}

