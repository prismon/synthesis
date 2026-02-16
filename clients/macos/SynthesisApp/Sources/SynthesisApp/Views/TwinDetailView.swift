import SwiftUI

struct TwinDetailView: View {
    @EnvironmentObject var mcp: MCPClient
    let tenantId: String
    let twinId: String

    @State private var events: [[String: Any]] = []
    @State private var note: String = "hello from macOS"

    var body: some View {
        VStack(alignment: .leading) {
            Text("Twin: \(twinId)").font(.headline)

            HStack {
                TextField("note", text: $note)
                Button("Append note.added") { Task { await appendNote() } }
                Button("Refresh") { Task { await loadEvents() } }
            }

            List {
                ForEach(events.indices, id: \.self) { i in
                    let e = events[i]
                    Text("\(e["seq"] as? Int ?? 0): \(e["type"] as? String ?? "")")
                }
            }
        }
        .padding()
        .task { await loadEvents() }
    }

    func loadEvents() async {
        do {
            let res = try await mcp.callTool(
                name: "twin.getEvents",
                arguments: ["tenantId": tenantId, "twinId": twinId, "fromSeq": 1, "limit": 200]
            )
            guard res.ok,
                  let result = res.result?.value as? [String: Any],
                  let rows = result["events"] as? [[String: Any]] else { return }
            events = rows
        } catch {
            print("loadEvents error:", error)
        }
    }

    func appendNote() async {
        do {
            let res = try await mcp.callTool(
                name: "twin.appendEvent",
                arguments: ["tenantId": tenantId, "twinId": twinId, "type": "note.added", "payload": ["note": note]]
            )
            if res.ok { await loadEvents() }
        } catch {
            print("appendNote error:", error)
        }
    }
}
