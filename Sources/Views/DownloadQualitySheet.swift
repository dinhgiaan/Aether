import SwiftUI

// MARK: – Sheet chọn chất lượng tải xuống
struct DownloadQualitySheet: View {
    let info: VideoDownloadInfo
    let onSelect: (StreamOption) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                Color(white: 0.08).ignoresSafeArea()
                
                VStack(spacing: 20) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(info.title)
                            .font(.headline)
                            .foregroundStyle(.white)
                            .lineLimit(2)
                        Text(info.author)
                            .font(.subheadline)
                            .foregroundStyle(.gray)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal)
                    .padding(.top, 12)
                    
                    Text("CHỌN CHẤT LƯỢNG TẢI:")
                        .font(.caption)
                        .foregroundStyle(.gray)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal)
                    
                    VStack(spacing: 10) {
                        if info.streams.isEmpty {
                            Text("Không tìm thấy luồng tải trực tiếp cho video này.")
                                .font(.subheadline)
                                .foregroundStyle(.gray)
                                .padding()
                        } else {
                            ForEach(info.streams) { stream in
                                Button {
                                    onSelect(stream)
                                } label: {
                                    HStack {
                                        Image(systemName: "video.fill")
                                            .foregroundStyle(.red)
                                        Text(stream.quality)
                                            .font(.system(size: 16, weight: .semibold))
                                            .foregroundStyle(.white)
                                        Spacer()
                                        Text(stream.audioURL != nil ? "Ghép Native HD" : "Trực tiếp")
                                            .font(.caption2)
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 2)
                                            .background(Color.white.opacity(0.12), in: Capsule())
                                            .foregroundStyle(.white.opacity(0.8))
                                        Image(systemName: "arrow.down.circle.fill")
                                            .foregroundStyle(.red)
                                    }
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 14)
                                    .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
                                }
                            }
                        }
                    }
                    .padding(.horizontal)
                    
                    Spacer()
                }
            }
            .navigationTitle("Tải Video Ngoại Tuyến")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Hủy") { dismiss() }
                        .foregroundStyle(.gray)
                }
            }
        }
        .preferredColorScheme(.dark)
    }
}
