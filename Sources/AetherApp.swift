import SwiftUI
import AVFoundation

@main
struct AetherApp: App {
    init() {
        // Category .playback: vẫn phát khi khóa màn hình / bật chế độ im lặng
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .moviePlayback)
        try? session.setActive(true)
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
