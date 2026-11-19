import SwiftUI
import WebKit

struct ContentView: View {
    @StateObject private var web = WebController()

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            Color.black.ignoresSafeArea()
            WebViewContainer(webView: web.webView)

            // Nút PiP chỉ hiện khi đang ở trang xem video
            if web.isWatching {
                Button { web.togglePiP() } label: {
                    Image(systemName: "pip.enter")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(width: 44, height: 44)
                        .background(.black.opacity(0.55), in: Circle())
                }
                .padding(.trailing, 12)
                .padding(.bottom, 96)
            }
        }
        .task { await web.start() }
    }
}

// Bọc WKWebView dựng sẵn trong WebController
struct WebViewContainer: UIViewRepresentable {
    let webView: WKWebView
    func makeUIView(context: Context) -> WKWebView { webView }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
