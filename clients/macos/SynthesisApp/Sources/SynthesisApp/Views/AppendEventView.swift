import SwiftUI

struct AppendEventView: View {
    @EnvironmentObject var mcp: MCPClient
    let tenantId: String
    let workspaceId: String
    let onCreated: () -> Void

    @State private var title: String = "My first twin"
    @State private var type: String = "demo.twin"

    var body: some View {
        VStack(alignment: .leading) {
            Text("Create Twin").font(.headline)
            TextField("title", text: $title)
            TextField("type", text: $type)
            Button("Create") {
                Task { await create() }
            }
        }
    }

    func create() async {
        do {
            _ = try await mcp.callTool(
                name: "twin.create",
                arguments: ["tenantId": tenantId, "workspaceId": workspaceId, "type": type, "title": title]
            )
            onCreated()
        } catch {
            print("create error:", error)
        }
    }
}
