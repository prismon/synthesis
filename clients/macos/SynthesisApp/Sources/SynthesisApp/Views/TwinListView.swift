import SwiftUI

struct TwinListView: View {
    @EnvironmentObject var mcp: MCPClient
    @State private var tenantId: String = "tenant_demo"
    @State private var workspaceId: String = "ws_demo"
    @State private var twins: [[String: Any]] = []
    @State private var selectedTwinId: String?

    var body: some View {
        NavigationSplitView {
            VStack {
                HStack {
                    TextField("tenantId", text: $tenantId)
                    TextField("workspaceId", text: $workspaceId)
                    Button("Refresh") { Task { await refresh() } }
                }
                .padding()

                List(selection: $selectedTwinId) {
                    ForEach(twins.indices, id: \.self) { i in
                        let t = twins[i]
                        Text("\(t["title"] as? String ?? "(no title)")")
                            .tag(t["id"] as? String)
                    }
                }

                Divider()

                AppendEventView(tenantId: tenantId, workspaceId: workspaceId, onCreated: {
                    Task { await refresh() }
                })
                .padding()
            }
        } detail: {
            if let twinId = selectedTwinId {
                TwinDetailView(tenantId: tenantId, twinId: twinId)
            } else {
                Text("Select a twin")
            }
        }
        .task {
            do { try await mcp.initialize() } catch { print("init error:", error) }
            await refresh()
        }
    }

    func refresh() async {
        do {
            let result = try await mcp.callTool(
                name: "twin.list",
                arguments: ["tenantId": tenantId, "workspaceId": workspaceId]
            )
            guard let rows = result?["twins"] as? [[String: Any]] else { return }
            twins = rows
        } catch {
            print("refresh error:", error)
        }
    }
}
