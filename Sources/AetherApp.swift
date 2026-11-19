import SwiftUI
import AVFoundation

@main
struct AetherApp: App {
    init() {
        // Kích hoạt khiên bảo vệ chống dịch ngược và phân tích mã
        SecurityGuard.activate()

        // Category .playback: vẫn phát khi khóa màn hình / bật chế độ im lặng
        // .mixWithOthers: giảm thiểu ngắt quãng âm thanh khi có notification nhỏ từ app khác
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playback, mode: .moviePlayback, options: [.mixWithOthers])
            try session.setActive(true)
        } catch {
            NSLog("Aether: AVAudioSession lỗi: %@", error.localizedDescription)
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
