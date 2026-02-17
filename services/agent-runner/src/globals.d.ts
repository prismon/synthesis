declare const process: {
  env: Record<string, string | undefined>;
  on(event: "SIGINT", listener: () => void | Promise<void>): void;
  exit(code?: number): never;
};
