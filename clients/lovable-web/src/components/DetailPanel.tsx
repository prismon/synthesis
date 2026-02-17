import type { Dispatch, SetStateAction } from "react";
import type { Twin, TwinEvent } from "../types";

type Banner = { tone: "success" | "error"; text: string } | null;

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

type DetailPanelProps = {
  selectedTwinId: string | null;
  banner: Banner;
  detailError: string | null;
  isDetailLoading: boolean;
  isSaving: boolean;
  activeTwin: Twin | null;
  editTitle: string;
  setEditTitle: Dispatch<SetStateAction<string>>;
  editType: string;
  setEditType: Dispatch<SetStateAction<string>>;
  eventType: string;
  setEventType: Dispatch<SetStateAction<string>>;
  eventPayload: string;
  setEventPayload: Dispatch<SetStateAction<string>>;
  events: TwinEvent[];
  onSaveTwin: () => void;
  onReload: () => void;
  onAppendEvent: () => void;
};

export function DetailPanel(props: DetailPanelProps) {
  return (
    <section className="panel detail">
      {props.banner ? <p className={props.banner.tone === "error" ? "error" : "success"}>{props.banner.text}</p> : null}

      {!props.selectedTwinId ? (
        <div className="empty">
          <h2>Select a twin</h2>
          <p>Choose any twin on the left to inspect state, update metadata, and append events.</p>
        </div>
      ) : (
        <div className="stack detail-stack">
          <section className="stack">
            <h2>Twin Metadata</h2>
            <p className="meta-id">{props.selectedTwinId}</p>
            {props.detailError ? <p className="error">{props.detailError}</p> : null}
            {props.isDetailLoading ? <p className="muted">Loading twin details...</p> : null}

            <label>
              Title
              <input value={props.editTitle} onChange={(e) => props.setEditTitle(e.target.value)} />
            </label>
            <label>
              Type
              <input value={props.editType} onChange={(e) => props.setEditType(e.target.value)} />
            </label>
            <div className="actions-inline">
              <button className="action" onClick={props.onSaveTwin} disabled={props.isSaving || !props.selectedTwinId}>
                Save Twin
              </button>
              <button className="ghost" onClick={props.onReload}>
                Reload
              </button>
            </div>
            {props.activeTwin ? (
              <p className="muted">Created {formatDate(props.activeTwin.createdAt)} in workspace {props.activeTwin.workspaceId}</p>
            ) : null}
          </section>

          <section className="stack">
            <h2>Append Event</h2>
            <label>
              Event Type
              <input value={props.eventType} onChange={(e) => props.setEventType(e.target.value)} />
            </label>
            <label>
              Payload JSON
              <textarea value={props.eventPayload} onChange={(e) => props.setEventPayload(e.target.value)} rows={7} />
            </label>
            <button className="action" onClick={props.onAppendEvent} disabled={props.isSaving || !props.selectedTwinId}>
              Append Event
            </button>
          </section>

          <section className="stack events">
            <h2>Event Stream ({props.events.length})</h2>
            <ul>
              {props.events.map((event) => (
                <li key={`${event.twinId}:${event.seq}`}>
                  <header>
                    <strong>#{event.seq}</strong>
                    <span>{event.type}</span>
                  </header>
                  <small>{formatDate(event.createdAt)}</small>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </section>
  );
}
