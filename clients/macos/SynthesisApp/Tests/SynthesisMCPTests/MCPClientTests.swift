/**
 * Acceptance tests for:
 *   ADR-002 — Swift macOS client: thin JSON-RPC 2.0 client over Streamable HTTP
 *   ADR-004 — MCP protocol: initialize, tools/call, tools/list via JSON-RPC
 */
import XCTest
@testable import SynthesisMCP

// MARK: - MockURLProtocol

final class MockURLProtocol: URLProtocol {
    static var requestHandler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = Self.requestHandler else {
            XCTFail("No request handler set")
            return
        }
        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

// MARK: - Helpers

/// Read request body from httpBody or httpBodyStream (URLProtocol may nil-out httpBody)
private func bodyData(from request: URLRequest) -> Data? {
    if let body = request.httpBody { return body }
    guard let stream = request.httpBodyStream else { return nil }
    stream.open()
    defer { stream.close() }
    var data = Data()
    let bufSize = 4096
    let buf = UnsafeMutablePointer<UInt8>.allocate(capacity: bufSize)
    defer { buf.deallocate() }
    while stream.hasBytesAvailable {
        let read = stream.read(buf, maxLength: bufSize)
        if read <= 0 { break }
        data.append(buf, count: read)
    }
    return data
}

private func bodyJSON(from request: URLRequest) -> [String: Any]? {
    guard let data = bodyData(from: request) else { return nil }
    return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
}

// MARK: - Tests

final class MCPClientTests: XCTestCase {
    var session: URLSession!
    var client: MCPClient!

    override func setUp() {
        super.setUp()
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockURLProtocol.self]
        session = URLSession(configuration: config)
        client = MCPClient(baseURL: URL(string: "http://localhost:8080")!, session: session)
    }

    override func tearDown() {
        MockURLProtocol.requestHandler = nil
        super.tearDown()
    }

    // MARK: - [ADR-002][ADR-004] initialize

    func testInitializeSendsCorrectJSONRPCAndCapturesSessionId() async throws {
        var capturedBodies: [[String: Any]] = []
        var capturedHeaders: [[String: String]] = []

        MockURLProtocol.requestHandler = { request in
            let body = bodyJSON(from: request) ?? [:]
            capturedBodies.append(body)
            capturedHeaders.append(request.allHTTPHeaderFields ?? [:])
            let method = body["method"] as? String ?? ""

            if method == "initialize" {
                let responseJSON = """
                {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-03-26","capabilities":{},"serverInfo":{"name":"synthesis","version":"0.0.1"}}}
                """.data(using: .utf8)!
                let httpResp = HTTPURLResponse(
                    url: request.url!, statusCode: 200, httpVersion: nil,
                    headerFields: ["Mcp-Session-Id": "test-session-123"]
                )!
                return (httpResp, responseJSON)
            } else {
                let httpResp = HTTPURLResponse(url: request.url!, statusCode: 202, httpVersion: nil, headerFields: nil)!
                return (httpResp, "{}".data(using: .utf8)!)
            }
        }

        try await client.initialize()

        // First request should be initialize with JSON-RPC fields
        XCTAssertGreaterThanOrEqual(capturedBodies.count, 1)
        XCTAssertEqual(capturedBodies[0]["jsonrpc"] as? String, "2.0")
        XCTAssertEqual(capturedBodies[0]["method"] as? String, "initialize")
        XCTAssertNotNil(capturedBodies[0]["id"])

        // Second request (notification) should carry session ID from response
        if capturedHeaders.count >= 2 {
            XCTAssertEqual(capturedHeaders[1]["Mcp-Session-Id"], "test-session-123")
        }
    }

    func testInitializeThrowsOnErrorResponse() async {
        MockURLProtocol.requestHandler = { request in
            let responseJSON = """
            {"jsonrpc":"2.0","id":1,"error":{"code":-32600,"message":"Bad init"}}
            """.data(using: .utf8)!
            let httpResp = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (httpResp, responseJSON)
        }

        do {
            try await client.initialize()
            XCTFail("Expected error")
        } catch {
            XCTAssertTrue(error.localizedDescription.contains("Bad init"))
        }
    }

    // MARK: - [ADR-004] callTool

    func testCallToolSendsNameAndArguments() async throws {
        var capturedBody: [String: Any]?

        MockURLProtocol.requestHandler = { request in
            capturedBody = bodyJSON(from: request)
            let responseJSON = """
            {"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"{\\"twins\\":[]}"}]}}
            """.data(using: .utf8)!
            let httpResp = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (httpResp, responseJSON)
        }

        _ = try await client.callTool(name: "twin.list", arguments: ["tenantId": "t1"])

        XCTAssertEqual(capturedBody?["method"] as? String, "tools/call")
        let params = capturedBody?["params"] as? [String: Any]
        XCTAssertEqual(params?["name"] as? String, "twin.list")
    }

    func testCallToolParsesTextContent() async throws {
        MockURLProtocol.requestHandler = { request in
            let responseJSON = """
            {"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"{\\"twinId\\":\\"twin_123\\",\\"eventSeq\\":1}"}]}}
            """.data(using: .utf8)!
            let httpResp = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (httpResp, responseJSON)
        }

        let result = try await client.callTool(name: "twin.create", arguments: ["tenantId": "t1"])
        XCTAssertEqual(result?["twinId"] as? String, "twin_123")
        XCTAssertEqual(result?["eventSeq"] as? Int, 1)
    }

    func testCallToolThrowsOnError() async {
        MockURLProtocol.requestHandler = { request in
            let responseJSON = """
            {"jsonrpc":"2.0","id":1,"error":{"code":-32603,"message":"Internal error"}}
            """.data(using: .utf8)!
            let httpResp = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (httpResp, responseJSON)
        }

        do {
            _ = try await client.callTool(name: "twin.list", arguments: [:])
            XCTFail("Expected error")
        } catch {
            XCTAssertTrue(error.localizedDescription.contains("Internal error"))
        }
    }

    // MARK: - [ADR-004] listTools

    func testListToolsReturnsParsedMCPToolArray() async throws {
        MockURLProtocol.requestHandler = { request in
            let responseJSON = """
            {"jsonrpc":"2.0","id":1,"result":{"tools":[{"name":"twin.list","description":"List twins"},{"name":"twin.create","description":"Create twin"}]}}
            """.data(using: .utf8)!
            let httpResp = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (httpResp, responseJSON)
        }

        let tools = try await client.listTools()
        XCTAssertEqual(tools.count, 2)
        XCTAssertEqual(tools[0].name, "twin.list")
        XCTAssertEqual(tools[1].name, "twin.create")
    }

    // MARK: - [ADR-002] Request IDs increment

    func testRequestIDsIncrementSequentially() async throws {
        var requestIds: [Int] = []

        MockURLProtocol.requestHandler = { request in
            if let body = bodyJSON(from: request), let id = body["id"] as? Int {
                requestIds.append(id)
            }
            let responseJSON = """
            {"jsonrpc":"2.0","id":1,"result":{"tools":[]}}
            """.data(using: .utf8)!
            let httpResp = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (httpResp, responseJSON)
        }

        _ = try await client.listTools()
        _ = try await client.listTools()
        _ = try await client.listTools()

        XCTAssertEqual(requestIds, [1, 2, 3])
    }

    // MARK: - SSE Response Parsing

    func testHandlesSSEResponse() async throws {
        MockURLProtocol.requestHandler = { request in
            let sse = "event: message\ndata: {\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"tools\":[]}}\n\n"
            let httpResp = HTTPURLResponse(
                url: request.url!, statusCode: 200, httpVersion: nil,
                headerFields: ["Content-Type": "text/event-stream"]
            )!
            return (httpResp, sse.data(using: .utf8)!)
        }

        let tools = try await client.listTools()
        XCTAssertEqual(tools.count, 0)
    }

    func testHandlesSSEWithIdLine() async throws {
        MockURLProtocol.requestHandler = { request in
            let sse = "event: message\nid: evt_1\ndata: {\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"tools\":[{\"name\":\"twin.list\",\"description\":\"List\"}]}}\n\n"
            let httpResp = HTTPURLResponse(
                url: request.url!, statusCode: 200, httpVersion: nil,
                headerFields: ["Content-Type": "text/event-stream"]
            )!
            return (httpResp, sse.data(using: .utf8)!)
        }

        let tools = try await client.listTools()
        XCTAssertEqual(tools.count, 1)
        XCTAssertEqual(tools[0].name, "twin.list")
    }

    func testHandlesJSONResponse() async throws {
        MockURLProtocol.requestHandler = { request in
            let json = "{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"tools\":[]}}"
            let httpResp = HTTPURLResponse(
                url: request.url!, statusCode: 200, httpVersion: nil,
                headerFields: ["Content-Type": "application/json"]
            )!
            return (httpResp, json.data(using: .utf8)!)
        }

        let tools = try await client.listTools()
        XCTAssertEqual(tools.count, 0)
    }

    func testSSEWithEmptyDataSkipped() async throws {
        MockURLProtocol.requestHandler = { request in
            let sse = "event: message\ndata: \ndata: {\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"tools\":[]}}\n\n"
            let httpResp = HTTPURLResponse(
                url: request.url!, statusCode: 200, httpVersion: nil,
                headerFields: ["Content-Type": "text/event-stream"]
            )!
            return (httpResp, sse.data(using: .utf8)!)
        }

        let tools = try await client.listTools()
        XCTAssertEqual(tools.count, 0)
    }

    // MARK: - Tool Operations (end-to-end with mock)

    func testCallTwinListReturnsEmptyArray() async throws {
        MockURLProtocol.requestHandler = { request in
            let sse = "event: message\ndata: {\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"content\":[{\"type\":\"text\",\"text\":\"{\\\"twins\\\":[]}\"}]}}\n\n"
            let httpResp = HTTPURLResponse(
                url: request.url!, statusCode: 200, httpVersion: nil,
                headerFields: ["Content-Type": "text/event-stream"]
            )!
            return (httpResp, sse.data(using: .utf8)!)
        }

        let result = try await client.callTool(name: "twin.list", arguments: ["tenantId": "t1"])
        let twins = result?["twins"] as? [Any]
        XCTAssertNotNil(twins)
        XCTAssertEqual(twins?.count, 0)
    }

    func testCallTwinCreateReturnsId() async throws {
        MockURLProtocol.requestHandler = { request in
            let sse = "event: message\ndata: {\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"content\":[{\"type\":\"text\",\"text\":\"{\\\"twinId\\\":\\\"twin_abc\\\",\\\"eventSeq\\\":1}\"}]}}\n\n"
            let httpResp = HTTPURLResponse(
                url: request.url!, statusCode: 200, httpVersion: nil,
                headerFields: ["Content-Type": "text/event-stream"]
            )!
            return (httpResp, sse.data(using: .utf8)!)
        }

        let result = try await client.callTool(name: "twin.create", arguments: ["tenantId": "t1"])
        XCTAssertEqual(result?["twinId"] as? String, "twin_abc")
        XCTAssertEqual(result?["eventSeq"] as? Int, 1)
    }

    func testCallTwinGetEventsReturnsList() async throws {
        MockURLProtocol.requestHandler = { request in
            let sse = "event: message\ndata: {\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"content\":[{\"type\":\"text\",\"text\":\"{\\\"events\\\":[{\\\"seq\\\":1,\\\"type\\\":\\\"note\\\"}]}\"}]}}\n\n"
            let httpResp = HTTPURLResponse(
                url: request.url!, statusCode: 200, httpVersion: nil,
                headerFields: ["Content-Type": "text/event-stream"]
            )!
            return (httpResp, sse.data(using: .utf8)!)
        }

        let result = try await client.callTool(name: "twin.getEvents", arguments: ["twinId": "twin_abc"])
        let events = result?["events"] as? [[String: Any]]
        XCTAssertNotNil(events)
        XCTAssertEqual(events?.count, 1)
        XCTAssertEqual(events?.first?["seq"] as? Int, 1)
        XCTAssertEqual(events?.first?["type"] as? String, "note")
    }

    func testCallTwinAppendEventReturnsSeq() async throws {
        MockURLProtocol.requestHandler = { request in
            let sse = "event: message\ndata: {\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"content\":[{\"type\":\"text\",\"text\":\"{\\\"seq\\\":5,\\\"event\\\":{\\\"type\\\":\\\"note\\\",\\\"body\\\":\\\"hi\\\"}}\"}]}}\n\n"
            let httpResp = HTTPURLResponse(
                url: request.url!, statusCode: 200, httpVersion: nil,
                headerFields: ["Content-Type": "text/event-stream"]
            )!
            return (httpResp, sse.data(using: .utf8)!)
        }

        let result = try await client.callTool(name: "twin.appendEvent", arguments: ["twinId": "twin_abc", "event": ["type": "note", "body": "hi"]])
        XCTAssertEqual(result?["seq"] as? Int, 5)
        let event = result?["event"] as? [String: Any]
        XCTAssertEqual(event?["type"] as? String, "note")
    }

    func testCallToolReturnsNilForEmptyContent() async throws {
        MockURLProtocol.requestHandler = { request in
            let json = "{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{}}"
            let httpResp = HTTPURLResponse(
                url: request.url!, statusCode: 200, httpVersion: nil,
                headerFields: ["Content-Type": "application/json"]
            )!
            return (httpResp, json.data(using: .utf8)!)
        }

        let result = try await client.callTool(name: "twin.list", arguments: [:])
        XCTAssertNil(result)
    }

    // MARK: - Error Handling

    func testCallToolThrowsOnHTTP500() async {
        MockURLProtocol.requestHandler = { request in
            let httpResp = HTTPURLResponse(
                url: request.url!, statusCode: 500, httpVersion: nil, headerFields: nil
            )!
            return (httpResp, "Internal Server Error".data(using: .utf8)!)
        }

        do {
            _ = try await client.callTool(name: "twin.list", arguments: [:])
            XCTFail("Expected error on HTTP 500")
        } catch {
            // Should throw a decoding error since body is not valid JSON-RPC
        }
    }

    func testMalformedSSEResponseThrows() async {
        MockURLProtocol.requestHandler = { request in
            let sse = "event: message\nid: evt_1\n\n"
            let httpResp = HTTPURLResponse(
                url: request.url!, statusCode: 200, httpVersion: nil,
                headerFields: ["Content-Type": "text/event-stream"]
            )!
            return (httpResp, sse.data(using: .utf8)!)
        }

        do {
            _ = try await client.listTools()
            XCTFail("Expected error for malformed SSE")
        } catch let error as MCPError {
            XCTAssertTrue(error.message.contains("No data field"))
        } catch {
            // MCPError expected, but any error is acceptable
        }
    }

    func testNonJSONDataInSSEThrows() async {
        MockURLProtocol.requestHandler = { request in
            let sse = "event: message\ndata: not-json-at-all\n\n"
            let httpResp = HTTPURLResponse(
                url: request.url!, statusCode: 200, httpVersion: nil,
                headerFields: ["Content-Type": "text/event-stream"]
            )!
            return (httpResp, sse.data(using: .utf8)!)
        }

        do {
            _ = try await client.listTools()
            XCTFail("Expected decoding error for invalid JSON in SSE")
        } catch {
            // DecodingError expected
        }
    }

    // MARK: - Session Management

    func testSessionIdSentOnSubsequentRequests() async throws {
        var capturedHeaders: [[String: String]] = []

        MockURLProtocol.requestHandler = { request in
            capturedHeaders.append(request.allHTTPHeaderFields ?? [:])
            let body = bodyJSON(from: request) ?? [:]
            let method = body["method"] as? String ?? ""

            if method == "initialize" {
                let json = "{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"protocolVersion\":\"2025-03-26\",\"capabilities\":{},\"serverInfo\":{\"name\":\"test\",\"version\":\"0.1\"}}}"
                let httpResp = HTTPURLResponse(
                    url: request.url!, statusCode: 200, httpVersion: nil,
                    headerFields: ["Mcp-Session-Id": "sess-42", "Content-Type": "application/json"]
                )!
                return (httpResp, json.data(using: .utf8)!)
            } else if method == "notifications/initialized" {
                let httpResp = HTTPURLResponse(url: request.url!, statusCode: 202, httpVersion: nil, headerFields: nil)!
                return (httpResp, "{}".data(using: .utf8)!)
            } else {
                let json = "{\"jsonrpc\":\"2.0\",\"id\":2,\"result\":{\"tools\":[]}}"
                let httpResp = HTTPURLResponse(
                    url: request.url!, statusCode: 200, httpVersion: nil,
                    headerFields: ["Content-Type": "application/json"]
                )!
                return (httpResp, json.data(using: .utf8)!)
            }
        }

        try await client.initialize()
        _ = try await client.listTools()

        // First request (initialize) should NOT have session ID
        XCTAssertNil(capturedHeaders[0]["Mcp-Session-Id"])
        // Notification (2nd) and listTools (3rd) should carry session ID
        if capturedHeaders.count >= 3 {
            XCTAssertEqual(capturedHeaders[1]["Mcp-Session-Id"], "sess-42")
            XCTAssertEqual(capturedHeaders[2]["Mcp-Session-Id"], "sess-42")
        }
    }

    func testInitializedFlagSetAfterInit() async throws {
        MockURLProtocol.requestHandler = { request in
            let body = bodyJSON(from: request) ?? [:]
            let method = body["method"] as? String ?? ""

            if method == "initialize" {
                let json = "{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"protocolVersion\":\"2025-03-26\",\"capabilities\":{},\"serverInfo\":{\"name\":\"test\",\"version\":\"0.1\"}}}"
                let httpResp = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
                return (httpResp, json.data(using: .utf8)!)
            } else {
                let httpResp = HTTPURLResponse(url: request.url!, statusCode: 202, httpVersion: nil, headerFields: nil)!
                return (httpResp, "{}".data(using: .utf8)!)
            }
        }

        XCTAssertFalse(client.initialized)
        try await client.initialize()
        // initialized is set on MainActor; give it a tick
        try await Task.sleep(nanoseconds: 50_000_000)
        XCTAssertTrue(client.initialized)
    }
}
