export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type Twin = {
  id: string;
  tenantId: string;
  workspaceId: string;
  type: string;
  title: string;
  createdAt: string;
};

export type TwinEvent = {
  tenantId: string;
  twinId: string;
  seq: number;
  type: string;
  event: JsonValue;
  createdAt: string;
};
