import SwiftUI
import AVKit

struct OfflineLibraryView: View {
    var onBack: (() -> Void)? = nil
    // Quan sát lớp đệm đã throttle thay vì OfflineManager: tiến trình tải cập nhật rất dày, quan sát thẳng sẽ
    // dựng lại cả danh sách (kể cả đọc file/giải mã ảnh của từng hàng) hàng chục lần mỗi giây
    @ObservedObject private var downloads = DownloadUIState.shared
    @Environment(\.dismiss) private var dismiss
    @State private var playingVideo: OfflineVideo?
    // Vuốt từ mép trái sang phải để quay lại (giống nút back)
    @State private var dragX: CGFloat = 0
    @State private var isEdgeDragging = false
    private let edgeWidth: CGFloat = 28           // vùng nhận vuốt: 28pt sát mép trái
    private let commitDistance: CGFloat = 110     // kéo quá ngưỡng này thì quay lại

    /// Quay lại: ưu tiên callback của ContentView (có animation riêng), không có thì dismiss
    private func goBack() {
        if let onBack = onBack { onBack() } else { dismiss() }
    }

    /// Vuốt từ mép trái: màn hình đi theo ngón tay; thả đủ xa hoặc vuốt nhanh thì quay lại, không thì bật về
    private var edgeSwipeBack: some Gesture {
        DragGesture(minimumDistance: 12, coordinateSpace: .global)
            .onChanged { value in
                if !isEdgeDragging {
                    // Chỉ bắt đầu khi chạm từ mép trái và hướng kéo chủ yếu là ngang (không cướp thao tác cuộn danh sách)
                    guard value.startLocation.x < edgeWidth,
                          value.translation.width > abs(value.translation.height) else { return }
                    isEdgeDragging = true
                }
                dragX = max(0, value.translation.width)
            }
            .onEnded { value in
                guard isEdgeDragging else { return }
                isEdgeDragging = false
                if value.translation.width > commitDistance || value.predictedEndTranslation.width > 220 {
                    goBack()
                } else {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) { dragX = 0 }
                }
            }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()
                
                if downloads.downloaded.isEmpty && downloads.progress.isEmpty {
                    EmptyOfflineView()
                } else {
                    List {
                        if !downloads.progress.isEmpty {
                            ActiveDownloadingSection(downloads: downloads)
                        }
                        
                        DownloadedListSection(
                            videos: downloads.downloaded,
                            onPlay: { video in playingVideo = video },
                            onDelete: { video in OfflineManager.shared.deleteVideo(video) }
                        )
                    }
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle("Video Ngoại Tuyến")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        goBack()
                    } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 34, height: 34)
                            .background(Circle().fill(Color.white.opacity(0.16)))
                    }
                    .accessibilityLabel("Quay lại")
                }
            }
            .fullScreenCover(item: $playingVideo) { video in
                ZStack(alignment: .topTrailing) {
                    NativeVideoPlayer(url: video.videoURL, title: video.title) {
                        playingVideo = nil
                    }
                    .ignoresSafeArea()
                    
                    Button {
                        playingVideo = nil
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 32))
                            .foregroundStyle(.white.opacity(0.85))
                            .background(Circle().fill(Color.black.opacity(0.6)))
                            .padding(.top, 52)
                            .padding(.trailing, 20)
                    }
                }
            }
        }
        .preferredColorScheme(.dark)
        .offset(x: dragX)
        // simultaneousGesture: không chặn cuộn danh sách / bấm nút; chỉ hoạt động khi bắt đầu từ mép trái
        .simultaneousGesture(edgeSwipeBack)
    }
}

// MARK: – Empty State
private struct EmptyOfflineView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "arrow.down.circle")
                .font(.system(size: 56, weight: .thin))
                .foregroundStyle(.gray)
            Text("Chưa có video tải xuống")
                .font(.headline)
                .foregroundStyle(.white)
            Text("Khi xem bất kỳ video nào, nhấn nút Tải xuống để lưu xem ngoại tuyến không cần mạng.")
                .font(.subheadline)
                .foregroundStyle(.gray)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
    }
}

// MARK: – Active Downloads Section
private struct ActiveDownloadingSection: View {
    @ObservedObject var downloads: DownloadUIState
    
    var body: some View {
        Section(header: Text("ĐANG TẢI").foregroundStyle(.gray)) {
            // activeIDs đã sắp xếp: Dictionary.keys có thứ tự ngẫu nhiên → các hàng nhảy qua lại ở mỗi lần cập nhật
            ForEach(downloads.activeIDs, id: \.self) { vidId in
                let progress = downloads.progress[vidId] ?? 0.0
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text(downloads.titles[vidId] ?? "Đang tải video...")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        Spacer()
                        Text("\(Int(progress * 100))%")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(.red)
                    }
                    
                    ProgressView(value: progress)
                        .tint(.red)
                    
                    Text(downloads.status[vidId] ?? "Đang kết nối...")
                        .font(.caption2)
                        .foregroundStyle(.gray)
                }
                .padding(.vertical, 4)
                .listRowBackground(Color(white: 0.12))
            }
        }
    }
}

// MARK: – Downloaded List Section
private struct DownloadedListSection: View {
    let videos: [OfflineVideo]
    let onPlay: (OfflineVideo) -> Void
    let onDelete: (OfflineVideo) -> Void
    
    var body: some View {
        Section(header: Text("VIDEO ĐÃ TẢI (\(videos.count))").foregroundStyle(.gray)) {
            ForEach(videos) { video in
                Button {
                    onPlay(video)
                } label: {
                    DownloadedVideoRow(video: video)
                }
                .listRowBackground(Color(white: 0.1))
                .swipeActions(edge: .trailing) {
                    Button(role: .destructive) {
                        onDelete(video)
                    } label: {
                        Label("Xoá", systemImage: "trash")
                    }
                }
            }
        }
    }
}

// MARK: – Single Video Row
private struct DownloadedVideoRow: View {
    let video: OfflineVideo
    
    // Trước đây là computed property → đọc thuộc tính file ngay trên main thread ở MỖI lần dựng lại hàng.
    // Giờ kiểm tra 1 lần ngoài main thread khi hàng xuất hiện.
    @State private var isCorrupted = false
    
    // nonisolated: được gọi từ Task.detached (ngoài main thread)
    private nonisolated static func checkCorrupted(_ video: OfflineVideo) -> Bool {
        // HLS: chỉ cần playlist tồn tại (file playlist nhỏ hơn 10KB là bình thường)
        if video.isHLS { return !FileManager.default.fileExists(atPath: video.videoURL.path) }
        guard let attrs = try? FileManager.default.attributesOfItem(atPath: video.videoURL.path),
              let size = attrs[.size] as? Int64 else { return true }
        return size < 10_000
    }
    
    var body: some View {
        HStack(spacing: 12) {
            VideoThumbnailView(thumbnailURL: video.thumbnailURL)
                .frame(width: 100, height: 56)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            
            VStack(alignment: .leading, spacing: 4) {
                Text(video.title)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                
                HStack(spacing: 6) {
                    Text(video.author)
                        .font(.caption)
                        .foregroundStyle(.gray)
                    Text("•")
                        .font(.caption)
                        .foregroundStyle(.gray)
                    Text(video.quality)
                        .font(.caption2)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .background(Color.white.opacity(0.15), in: RoundedRectangle(cornerRadius: 4))
                        .foregroundStyle(.white)
                }
                
                if isCorrupted {
                    Text("File bị lỗi – Vuốt sang trái để xoá")
                        .font(.caption2)
                        .foregroundStyle(.yellow)
                }
            }
            
            Spacer()
            
            if isCorrupted {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.title3)
                    .foregroundStyle(.yellow)
            } else {
                Image(systemName: "play.circle.fill")
                    .font(.title3)
                    .foregroundStyle(.red)
            }
        }
        .task(id: video.id) {
            let v = video
            isCorrupted = await Task.detached(priority: .utility) { Self.checkCorrupted(v) }.value
        }
    }
}

// MARK: – Video Thumbnail
/// Cache ảnh đã giải mã: trước đây UIImage(contentsOfFile:) chạy đồng bộ trên main thread trong body của MỖI hàng
/// ở MỖI lần dựng lại → giật khi cuộn danh sách / khi đang có video tải.
private enum ThumbnailCache {
    static let images = NSCache<NSString, UIImage>()
}

private struct VideoThumbnailView: View {
    let thumbnailURL: URL?
    @State private var image: UIImage?
    
    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(16/9, contentMode: .fill)
            } else {
                Rectangle()
                    .fill(Color(white: 0.2))
                    .overlay(
                        Image(systemName: "play.fill")
                            .foregroundStyle(.white.opacity(0.6))
                    )
            }
        }
        .task(id: thumbnailURL) { await load() }
    }
    
    private func load() async {
        guard let url = thumbnailURL else { image = nil; return }
        let key = url.path as NSString
        if let hit = ThumbnailCache.images.object(forKey: key) { image = hit; return }
        // Đọc + giải mã sẵn ngoài main thread (preparingForDisplay) rồi mới gán vào view
        let decoded = await Task.detached(priority: .userInitiated) {
            UIImage(contentsOfFile: url.path)?.preparingForDisplay()
        }.value
        if let decoded {
            ThumbnailCache.images.setObject(decoded, forKey: key)
            image = decoded
        }
    }
}

/// Bọc AVPlayerViewController để phát offline với đầy đủ tính năng: xoay ngang, PiP, điều khiển
struct NativeVideoPlayer: UIViewControllerRepresentable {
    let url: URL
    let title: String
    var onDismiss: (() -> Void)? = nil
    
    func makeCoordinator() -> Coordinator {
        Coordinator(onDismiss: onDismiss)
    }
    
    func makeUIViewController(context: Context) -> AVPlayerViewController {
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback, options: [])
        try? AVAudioSession.sharedInstance().setActive(true)
        
        let playerItem = AVPlayerItem(url: url)
        let player = AVPlayer(playerItem: playerItem)
        let controller = AVPlayerViewController()
        controller.player = player
        controller.allowsPictureInPicturePlayback = true
        controller.showsPlaybackControls = true
        controller.delegate = context.coordinator
        player.play()
        return controller
    }
    
    func updateUIViewController(_ uiViewController: AVPlayerViewController, context: Context) {}
    
    final class Coordinator: NSObject, AVPlayerViewControllerDelegate {
        var onDismiss: (() -> Void)?
        init(onDismiss: (() -> Void)?) {
            self.onDismiss = onDismiss
        }
        
        func playerViewControllerWillStopPictureInPicture(_ playerViewController: AVPlayerViewController) {
            onDismiss?()
        }
    }
}