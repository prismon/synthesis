import Foundation

struct MCPTool: Codable, Identifiable {
    let name: String
    let description: String
    let inputSchema: [String: AnyCodable]
    var id: String { name }
}

struct MCPToolListResponse: Codable {
    let tools: [MCPTool]
}

struct MCPToolCallRequest: Codable {
    let name: String
    let arguments: [String: AnyCodable]
}

struct MCPError: Codable {
    let code: String
    let message: String
}

struct MCPToolCallResponse: Codable {
    let ok: Bool
    let result: AnyCodable?
    let error: MCPError?
}

struct AnyCodable: Codable {
    let value: Any

    init(_ value: Any) { self.value = value }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let b = try? container.decode(Bool.self) { value = b; return }
        if let i = try? container.decode(Int.self) { value = i; return }
        if let d = try? container.decode(Double.self) { value = d; return }
        if let s = try? container.decode(String.self) { value = s; return }
        if let a = try? container.decode([AnyCodable].self) { value = a.map { $0.value }; return }
        if let o = try? container.decode([String: AnyCodable].self) { value = o.mapValues { $0.value }; return }
        value = NSNull()
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch value {
        case let b as Bool: try container.encode(b)
        case let i as Int: try container.encode(i)
        case let d as Double: try container.encode(d)
        case let s as String: try container.encode(s)
        case let a as [Any]:
            try container.encode(a.map { AnyCodable($0) })
        case let o as [String: Any]:
            try container.encode(o.mapValues { AnyCodable($0) })
        default:
            try container.encodeNil()
        }
    }
}
