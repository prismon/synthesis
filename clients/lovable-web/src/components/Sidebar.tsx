import type { Dispatch, SetStateAction } from "react";
import type { Twin } from "../types";

type SidebarProps = {
  tenantId: string;
  setTenantId: Dispatch<SetStateAction<string>>;
  workspaceId: string;
  setWorkspaceId: Dispatch<SetStateAction<string>>;
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  twins: Twin[];
  selectedTwinId: string | null;
  setSelectedTwinId: Dispatch<SetStateAction<string | null>>;
  listError: string | null;
  isReady: boolean;
  isListLoading: boolean;
  isSaving: boolean;
  createTitle: string;
  setCreateTitle: Dispatch<SetStateAction<string>>;
  createType: string;
  setCreateType: Dispatch<SetStateAction<string>>;
  onRefresh: () => void;
  onCreateTwin: () => void;
};

export function Sidebar(props: SidebarProps) {
  return (
    <aside className="panel sidebar">
      <section className="stack">
        <h2>Scope</h2>
        <label>
          Tenant ID
          <input value={props.tenantId} onChange={(e) => props.setTenantId(e.target.value)} />
        </label>
        <label>
          Workspace ID (optional for list)
          <input value={props.workspaceId} onChange={(e) => props.setWorkspaceId(e.target.value)} />
        </label>
        <button className="action" onClick={props.onRefresh} disabled={!props.isReady || props.isListLoading}>
          {props.isListLoading ? "Refreshing..." : "Refresh Twins"}
        </button>
      </section>

      <section className="stack">
        <h2>Find</h2>
        <input
          placeholder="Search by id, title, type..."
          value={props.search}
          onChange={(e) => props.setSearch(e.target.value)}
        />
      </section>

      <section className="stack twins-list">
        <h2>Twins ({props.twins.length})</h2>
        {props.listError ? <p className="error">{props.listError}</p> : null}
        <ul>
          {props.twins.map((twin) => (
            <li key={twin.id}>
              <button
                className={props.selectedTwinId === twin.id ? "twin-row active" : "twin-row"}
                onClick={() => props.setSelectedTwinId(twin.id)}
              >
                <strong>{twin.title}</strong>
                <span>{twin.type}</span>
                <small>{twin.id}</small>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="stack">
        <h2>Create Twin</h2>
        <label>
          Title
          <input value={props.createTitle} onChange={(e) => props.setCreateTitle(e.target.value)} />
        </label>
        <label>
          Type
          <input value={props.createType} onChange={(e) => props.setCreateType(e.target.value)} />
        </label>
        <button className="action" onClick={props.onCreateTwin} disabled={props.isSaving || !props.isReady}>
          Create Twin
        </button>
      </section>
    </aside>
  );
}
