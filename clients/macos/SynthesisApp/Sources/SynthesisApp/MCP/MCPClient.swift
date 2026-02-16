import Foundation

final class MCPClient: ObservableObject {
    let baseURL: URL
    private let mcpURL: URL
    private var nextId = 0
    private var sessionId: String?

    @Published var initialized = false

    init(baseURL: URL) {
        self.baseURL = baseURL
        self.mcpURL = baseURL.appendingPathComponent("mcp")
    }

    // MARK: - JSON-RPC transport

    private func nextRequestId() -> Int {
        nextId += 1
        return nextId
    }

    private func send(method: String, params: [String: Any]? = nil) async throws -> JSONRPCResponse {
        var req = URLRequest(url: mcpURL)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let sid = sessionId {
            req.setValue(sid, forHTTPHeaderField: "Mcp-Session-Id")
        }

        let rpcRequest = JSONRPCRequest(
            id: nextRequestId(),
            method: method,
            params: params.map { AnyCodable($0) }
        )
        req.httpBody = try JSONEncoder().encode(rpcRequest)

        let (data, response) = try await URLSession.shared.data(for: req)

        if let httpResponse = response as? HTTPURLResponse,
           let sid = httpResponse.value(forHTTPHeaderField: "Mcp-Session-Id") {
            sessionId = sid
        }

        return try JSONDecoder().decode(JSONRPCResponse.self, from: data)
    }

    private func sendNotification(method: String, params: [String: Any]? = nil) async throws {
        var req = URLRequest(url: mcpURL)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let sid = sessionId {
            req.setValue(sid, forHTTPHeaderField: "Mcp-Session-Id")
        }

        // Notifications have no id
        var body: [String: Any] = ["jsonrpc": "2.0", "method": method]
        if let p = params { body["params"] = p }
        req.httpBody = try JSONSerialization.data(withJSONObject: body)

        _ = try await URLSession.shared.data(for: req)
    }

    // MARK: - MCP Lifecycle

    func initialize() async throws {
        let resp = try await send(method: "initialize", params: [
            "protocolVersion": "2025-03-26",
            "capabilities": [:] as [String: Any],
            "clientInfo": ["name": "SynthesisApp", "version": "0.0.1"]
        ])

        if resp.error != nil {
            throw MCPError(message: resp.error?.message ?? "Initialize failed")
        }

        // Send initialized notification
        try await sendNotification(method: "notifications/initialized")

        await MainActor.run { initialized = true }
    }

    // MARK: - Tools

    func listTools() async throws -> [MCPTool] {
        let resp = try await send(method: "tools/list")

        guard let result = resp.result?.value as? [String: Any],
              let tools = result["tools"] as? [[String: Any]] else {
            return []
        }

        return tools.compactMap { t in
            guard let name = t["name"] as? String,
                  let desc = t["description"] as? String else { return nil }
            return MCPTool(name: name, description: desc)
        }
    }

    func callTool(name: String, arguments: [String: Any]) async throws -> [String: Any]? {
        let resp = try await send(method: "tools/call", params: [
            "name": name,
            "arguments": arguments
        ])

        if let err = resp.error {
            throw MCPError(message: err.message)
        }

        // Parse MCP content array: [{type:"text", text:"..."}]
        guard let result = resp.result?.value as? [String: Any],
              let content = result["content"] as? [[String: Any]],
              let first = content.first,
              let text = first["text"] as? String,
              let data = text.data(using: .utf8) else {
            return nil
        }

        return try JSONSerialization.jsonObject(with: data) as? [String: Any]
    }
}

struct MCPError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}
