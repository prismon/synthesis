import Foundation

final class MCPClient: ObservableObject {
    let baseURL: URL

    init(baseURL: URL) {
        self.baseURL = baseURL
    }

    func listTools() async throws -> [MCPTool] {
        let url = baseURL.appendingPathComponent("/mcp/tools/list")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.httpBody = Data("{}".utf8)
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let (data, _) = try await URLSession.shared.data(for: req)
        let decoded = try JSONDecoder().decode(MCPToolListResponse.self, from: data)
        return decoded.tools
    }

    func callTool(name: String, arguments: [String: Any]) async throws -> MCPToolCallResponse {
        let url = baseURL.appendingPathComponent("/mcp/tools/call")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        let body = MCPToolCallRequest(name: name, arguments: arguments.mapValues { AnyCodable($0) })
        req.httpBody = try JSONEncoder().encode(body)
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let (data, _) = try await URLSession.shared.data(for: req)
        return try JSONDecoder().decode(MCPToolCallResponse.self, from: data)
    }
}
