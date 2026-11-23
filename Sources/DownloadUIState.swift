import SwiftUI
import Combine

/// Lớp đệm giữa OfflineManager và giao diện.
/// OfflineManager cập nhật tiến trình theo từng đoạn/khối tải (có thể hàng chục lần mỗi giây, mỗi lần ghi 2 biến @Published).
/// Nếu view quan sát trực tiếp OfflineManager thì ContentView + danh sách thư viện bị dựng lại liên tục → giật khi đang tải.
/// Ở đây gom lại tối đa ~6-7 lần/giây; riêng danh sách video đã tải thì chuyển tiếp ngay (hiếm khi đổi).
@MainActor
final class DownloadUIState: ObservableObject {
    static let shared = DownloadUIState()

    @Published private(set) var progress: [String: Double] = [:]
    @Published private(set) var titles: [String: String] = [:]
    @Published private(set) var status: [String: String] = [:]
    @Published private(set) var downloaded: [OfflineVideo] = []

    private var bag = Set<AnyCancellable>()

    private init() {
        let manager = OfflineManager.shared
        downloaded = manager.downloadedVideos
        progress = manager.activeDownloadProgress
        titles = manager.activeDownloadTitles
        status = manager.activeDownloadStatus

        // DispatchQueue.main (không phải RunLoop.main): vẫn chạy khi người dùng đang cuộn danh sách
        manager.$activeDownloadProgress
            .throttle(for: .milliseconds(150), scheduler: DispatchQueue.main, latest: true)
            .sink { [weak self] in self?.progress = $0 }
            .store(in: &bag)
        manager.$activeDownloadStatus
            .throttle(for: .milliseconds(150), scheduler: DispatchQueue.main, latest: true)
            .sink { [weak self] in self?.status = $0 }
            .store(in: &bag)
        manager.$activeDownloadTitles
            .sink { [weak self] in self?.titles = $0 }
            .store(in: &bag)
        manager.$downloadedVideos
            .removeDuplicates()
            .sink { [weak self] in self?.downloaded = $0 }
            .store(in: &bag)
    }

    /// Thứ tự ổn định (theo videoId): Dictionary.keys có thứ tự ngẫu nhiên nên trước đây các hàng nhảy qua lại khi tải nhiều video
    var activeIDs: [String] { progress.keys.sorted() }
}