import { useCallback, useEffect, useMemo, useState } from "react";
import { MCPClient } from "./lib/mcpClient";
import type { JsonValue, Twin, TwinEvent } from "./types";
import { Sidebar } from "./components/Sidebar";
import { DetailPanel } from "./components/DetailPanel";

const DEFAULT_PAYLOAD = `{
  "note": "hello from web"
}`;

const MCP_BASE_URL = import.meta.env.VITE_MCP_BASE_URL ?? window.location.origin;

type Banner = { tone: "success" | "error"; text: string } | null;

function asMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function parsePayload(payload: string): JsonValue {
  return JSON.parse(payload) as JsonValue;
}

export default function App() {
  const client = useMemo(() => new MCPClient(MCP_BASE_URL), []);

  const [tenantId, setTenantId] = useState("tenant_demo");
  const [workspaceId, setWorkspaceId] = useState("ws_demo");
  const [search, setSearch] = useState("");

  const [twins, setTwins] = useState<Twin[]>([]);
  const [selectedTwinId, setSelectedTwinId] = useState<string | null>(null);
  const [activeTwin, setActiveTwin] = useState<Twin | null>(null);
  const [events, setEvents] = useState<TwinEvent[]>([]);

  const [createTitle, setCreateTitle] = useState("My first twin");
  const [createType, setCreateType] = useState("demo.twin");

  const [editTitle, setEditTitle] = useState("");
  const [editType, setEditType] = useState("");
  const [eventType, setEventType] = useState("note.added");
  const [eventPayload, setEventPayload] = useState(DEFAULT_PAYLOAD);

  const [isReady, setIsReady] = useState(false);
  const [isListLoading, setIsListLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner>(null);

  const filteredTwins = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return twins;
    return twins.filter((twin) =>
      [twin.id, twin.title, twin.type, twin.workspaceId].join(" ").toLowerCase().includes(needle)
    );
  }, [search, twins]);

  const refreshTwins = useCallback(async () => {
    if (!tenantId.trim()) return;
    setIsListLoading(true);
    setListError(null);

    try {
      const args = workspaceId.trim()
        ? { tenantId: tenantId.trim(), workspaceId: workspaceId.trim() }
        : { tenantId: tenantId.trim() };
      const result = await client.callTool<{ twins: Twin[] }>("twin.list", args);
      const rows = result.twins ?? [];
      setTwins(rows);
      setSelectedTwinId((current) => (current && !rows.some((twin) => twin.id === current) ? null : current));
    } catch (error) {
      setListError(asMessage(error));
    } finally {
      setIsListLoading(false);
    }
  }, [client, tenantId, workspaceId]);

  const loadDetail = useCallback(
    async (twinId: string) => {
      if (!tenantId.trim()) return;
      setIsDetailLoading(true);
      setDetailError(null);

      try {
        const [stateResult, eventsResult] = await Promise.all([
          client.callTool<{ twin: Twin }>("twin.getState", {
            tenantId: tenantId.trim(),
            twinId
          }),
          client.callTool<{ events: TwinEvent[] }>("twin.getEvents", {
            tenantId: tenantId.trim(),
            twinId,
            fromSeq: 1,
            limit: 200
          })
        ]);

        setActiveTwin(stateResult.twin);
        setEditTitle(stateResult.twin.title);
        setEditType(stateResult.twin.type);
        setEvents(eventsResult.events ?? []);
      } catch (error) {
        setDetailError(asMessage(error));
      } finally {
        setIsDetailLoading(false);
      }
    },
    [client, tenantId]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await client.initialize();
        if (!mounted) return;
        setIsReady(true);
      } catch (error) {
        if (!mounted) return;
        setListError(`Failed to initialize MCP session: ${asMessage(error)}`);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [client]);

  useEffect(() => {
    if (!isReady) return;
    void refreshTwins();
  }, [isReady, refreshTwins]);

  useEffect(() => {
    if (!selectedTwinId) {
      setActiveTwin(null);
      setEvents([]);
      return;
    }
    void loadDetail(selectedTwinId);
  }, [loadDetail, selectedTwinId]);

  async function createTwin() {
    if (!tenantId.trim()) return;
    if (!workspaceId.trim()) {
      setBanner({ tone: "error", text: "workspaceId is required when creating a twin." });
      return;
    }

    setIsSaving(true);
    setBanner(null);
    try {
      const result = await client.callTool<{ twinId: string }>("twin.create", {
        tenantId: tenantId.trim(),
        workspaceId: workspaceId.trim(),
        title: createTitle.trim(),
        type: createType.trim()
      });
      await refreshTwins();
      setSelectedTwinId(result.twinId);
      setBanner({ tone: "success", text: `Twin ${result.twinId} created.` });
    } catch (error) {
      setBanner({ tone: "error", text: asMessage(error) });
    } finally {
      setIsSaving(false);
    }
  }

  async function saveTwin() {
    if (!selectedTwinId || !tenantId.trim()) return;

    setIsSaving(true);
    setBanner(null);
    try {
      await client.callTool("twin.update", {
        tenantId: tenantId.trim(),
        twinId: selectedTwinId,
        title: editTitle.trim(),
        type: editType.trim()
      });
      await Promise.all([refreshTwins(), loadDetail(selectedTwinId)]);
      setBanner({ tone: "success", text: "Twin metadata saved." });
    } catch (error) {
      setBanner({ tone: "error", text: asMessage(error) });
    } finally {
      setIsSaving(false);
    }
  }

  async function appendEvent() {
    if (!selectedTwinId || !tenantId.trim()) return;

    setIsSaving(true);
    setBanner(null);
    try {
      const payload = parsePayload(eventPayload);
      await client.callTool("twin.appendEvent", {
        tenantId: tenantId.trim(),
        twinId: selectedTwinId,
        type: eventType.trim(),
        payload
      });
      await loadDetail(selectedTwinId);
      setBanner({ tone: "success", text: `Event "${eventType}" appended.` });
    } catch (error) {
      setBanner({ tone: "error", text: asMessage(error) });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="app">
      <div className="backdrop" />
      <header className="hero">
        <p className="kicker">Synthesis</p>
        <h1>Twins Studio</h1>
        <p className="subtitle">Browse, inspect, and edit twins through MCP tools from a Lovable-ready React client.</p>
      </header>

      <main className="layout">
        <Sidebar
          tenantId={tenantId}
          setTenantId={setTenantId}
          workspaceId={workspaceId}
          setWorkspaceId={setWorkspaceId}
          search={search}
          setSearch={setSearch}
          twins={filteredTwins}
          selectedTwinId={selectedTwinId}
          setSelectedTwinId={setSelectedTwinId}
          listError={listError}
          isReady={isReady}
          isListLoading={isListLoading}
          isSaving={isSaving}
          createTitle={createTitle}
          setCreateTitle={setCreateTitle}
          createType={createType}
          setCreateType={setCreateType}
          onRefresh={() => void refreshTwins()}
          onCreateTwin={() => void createTwin()}
        />

        <DetailPanel
          selectedTwinId={selectedTwinId}
          banner={banner}
          detailError={detailError}
          isDetailLoading={isDetailLoading}
          isSaving={isSaving}
          activeTwin={activeTwin}
          editTitle={editTitle}
          setEditTitle={setEditTitle}
          editType={editType}
          setEditType={setEditType}
          eventType={eventType}
          setEventType={setEventType}
          eventPayload={eventPayload}
          setEventPayload={setEventPayload}
          events={events}
          onSaveTwin={() => void saveTwin()}
          onReload={() => selectedTwinId && void loadDetail(selectedTwinId)}
          onAppendEvent={() => void appendEvent()}
        />
      </main>
    </div>
  );
}
