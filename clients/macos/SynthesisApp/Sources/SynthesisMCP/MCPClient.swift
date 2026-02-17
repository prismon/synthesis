import Foundation

public final class MCPClient: ObservableObject {
    public let baseURL: URL
    private let mcpURL: URL
    private let session: URLSession
    private var nextId = 0
    private var sessionId: String?

    @Published public var initialized = false

    public init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.mcpURL = baseURL.appendingPathComponent("mcp")
        self.session = session
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
        req.setValue("application/json, text/event-stream", forHTTPHeaderField: "Accept")
        if let sid = sessionId {
            req.setValue(sid, forHTTPHeaderField: "Mcp-Session-Id")
        }

        let rpcRequest = JSONRPCRequest(
            id: nextRequestId(),
            method: method,
            params: params.map { AnyCodable($0) }
        )
        req.httpBody = try JSONEncoder().encode(rpcRequest)

        let (data, response) = try await session.data(for: req)

        if let httpResponse = response as? HTTPURLResponse,
           let sid = httpResponse.value(forHTTPHeaderField: "Mcp-Session-Id") {
            sessionId = sid
        }

        let contentType = (response as? HTTPURLResponse)?
            .value(forHTTPHeaderField: "Content-Type") ?? ""

        if contentType.contains("text/event-stream") {
            let jsonData = try extractSSEData(from: data)
            return try JSONDecoder().decode(JSONRPCResponse.self, from: jsonData)
        }
        return try JSONDecoder().decode(JSONRPCResponse.self, from: data)
    }

    private func sendNotification(method: String, params: [String: Any]? = nil) async throws {
        var req = URLRequest(url: mcpURL)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("application/json, text/event-stream", forHTTPHeaderField: "Accept")
        if let sid = sessionId {
            req.setValue(sid, forHTTPHeaderField: "Mcp-Session-Id")
        }

        // Notifications have no id
        var body: [String: Any] = ["jsonrpc": "2.0", "method": method]
        if let p = params { body["params"] = p }
        req.httpBody = try JSONSerialization.data(withJSONObject: body)

        _ = try await session.data(for: req)
    }

    // MARK: - MCP Lifecycle

    public func initialize() async throws {
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

    public func listTools() async throws -> [MCPTool] {
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

    public func callTool(name: String, arguments: [String: Any]) async throws -> [String: Any]? {
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

    // MARK: - SSE Parsing

    private func extractSSEData(from data: Data) throws -> Data {
        guard let text = String(data: data, encoding: .utf8) else {
            throw MCPError(message: "Invalid UTF-8 in SSE response")
        }
        for line in text.components(separatedBy: "\n") {
            if line.hasPrefix("data: "), line.count > 6 {
                let json = String(line.dropFirst(6))
                if let d = json.data(using: .utf8) { return d }
            }
            if line.hasPrefix("data:"), !line.hasPrefix("data: ") {
                let json = String(line.dropFirst(5))
                if !json.isEmpty, let d = json.data(using: .utf8) { return d }
            }
        }
        throw MCPError(message: "No data field found in SSE response")
    }
}

public struct MCPError: LocalizedError {
    public let message: String
    public var errorDescription: String? { message }

    public init(message: String) {
        self.message = message
    }
}
