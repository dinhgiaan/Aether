import SwiftUI
import AVKit

struct OfflineLibraryView: View {
    @ObservedObject var offlineManager = OfflineManager.shared
    @Environment(\.dismiss) private var dismiss
    @State private var playingVideo: OfflineVideo?
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()
                
                if offlineManager.downloadedVideos.isEmpty && offlineManager.activeDownloadProgress.isEmpty {
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
                } else {
                    List {
                        // Section đang tải
                        if !offlineManager.activeDownloadProgress.isEmpty {
                            Section(header: Text("ĐANG TẢI").foregroundStyle(.gray)) {
                                ForEach(Array(offlineManager.activeDownloadProgress.keys), id: \.self) { vidId in
                                    HStack(spacing: 12) {
                                        ProgressView()
                                            .tint(.red)
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(offlineManager.activeDownloadTitles[vidId] ?? "Đang tải video...")
                                                .font(.subheadline)
                                                .foregroundStyle(.white)
                                                .lineLimit(1)
                                            Text(offlineManager.activeDownloadStatus[vidId] ?? "Vui lòng đợi trong giây lát...")
                                                .font(.caption2)
                                                .foregroundStyle(.gray)
                                        }
                                    }
                                    .listRowBackground(Color(white: 0.12))
                                }
                            }
                        }
                        
                        // Section danh sách đã tải
                        Section(header: Text("VIDEO ĐÃ TẢI (\(offlineManager.downloadedVideos.count))").foregroundStyle(.gray)) {
                            ForEach(offlineManager.downloadedVideos) { video in
                                Button {
                                    playingVideo = video
                                } label: {
                                    HStack(spacing: 12) {
                                        // Thumbnail
                                        Group {
                                            if let thumbURL = video.thumbnailURL,
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
                                        }
                                        
                                        Spacer()
                                        
                                        Image(systemName: "play.circle.fill")
                                            .font(.title3)
                                            .foregroundStyle(.red)
                                    }
                                }
                                .listRowBackground(Color(white: 0.1))
                                .swipeActions(edge: .trailing) {
                                    Button(role: .destructive) {
                                        offlineManager.deleteVideo(video)
                                    } label: {
                                        Label("Xoá", systemName: "trash")
                                    }
                                }
                            }
                        }
                    }
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle("Video Ngoại Tuyến")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Đóng") { dismiss() }
                        .foregroundStyle(.white)
                }
            }
            .fullScreenCover(item: $playingVideo) { video in
                NativeVideoPlayer(url: video.videoURL, title: video.title)
            }
        }
        .preferredColorScheme(.dark)
    }
}

/// Bọc AVPlayerViewController để phát offline với đầy đủ tính năng: xoay ngang, PiP, điều khiển
struct NativeVideoPlayer: UIViewControllerRepresentable {
    let url: URL
    let title: String
    
    func makeUIViewController(context: Context) -> AVPlayerViewController {
        let player = AVPlayer(url: url)
        let controller = AVPlayerViewController()
        controller.player = player
        controller.allowsPictureInPicturePlayback = true
        controller.showsPlaybackControls = true
        player.play()
        return controller
    }
    
    func updateUIViewController(_ uiViewController: AVPlayerViewController, context: Context) {}
}

