import SwiftUI
import AVKit

struct OfflineLibraryView: View {
    var onBack: (() -> Void)? = nil
    @ObservedObject var offlineManager = OfflineManager.shared
    @Environment(\.dismiss) private var dismiss
    @State private var playingVideo: OfflineVideo?
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()
                
                if offlineManager.downloadedVideos.isEmpty && offlineManager.activeDownloadProgress.isEmpty {
                    EmptyOfflineView()
                } else {
                    List {
                        if !offlineManager.activeDownloadProgress.isEmpty {
                            ActiveDownloadingSection(offlineManager: offlineManager)
                        }
                        
                        DownloadedListSection(
                            videos: offlineManager.downloadedVideos,
                            onPlay: { video in playingVideo = video },
                            onDelete: { video in offlineManager.deleteVideo(video) }
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
                        if let onBack = onBack {
                            onBack()
                        } else {
                            dismiss()
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "chevron.left")
                                .font(.system(size: 15, weight: .semibold))
                            Text("Quay lại")
                                .font(.system(size: 16, weight: .medium))
                        }
                        .foregroundStyle(.white)
                    }
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
    @ObservedObject var offlineManager: OfflineManager
    
    var body: some View {
        Section(header: Text("ĐANG TẢI").foregroundStyle(.gray)) {
            ForEach(Array(offlineManager.activeDownloadProgress.keys), id: \.self) { vidId in
                let progress = offlineManager.activeDownloadProgress[vidId] ?? 0.0
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text(offlineManager.activeDownloadTitles[vidId] ?? "Đang tải video...")
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
                    
                    Text(offlineManager.activeDownloadStatus[vidId] ?? "Đang kết nối...")
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
    
    private var isCorrupted: Bool {
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
    }
}

// MARK: – Video Thumbnail
private struct VideoThumbnailView: View {
    let thumbnailURL: URL?
    
    var body: some View {
        Group {
            if let thumbURL = thumbnailURL,
               let uiImg = UIImage(contentsOfFile: thumbURL.path) {
                Image(uiImage: uiImg)
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
