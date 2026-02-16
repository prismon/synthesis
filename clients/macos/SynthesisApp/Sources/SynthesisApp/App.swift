import SwiftUI

@main
struct SynthesisApp: App {
    @StateObject var mcp = MCPClient(baseURL: URL(string: "http://localhost:8080")!)

    var body: some Scene {
        WindowGroup {
            TwinListView()
                .environmentObject(mcp)
        }
    }
}
