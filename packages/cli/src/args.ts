export interface Args {
  command: string;
  values: Map<string, string>;
  flags: Set<string>;
  lists: Map<string, string[]>;
  positionals: string[];
}

const VALUE_KEYS = new Set(["config", "out", "name", "app-id", "preset", "target"]);
const LIST_KEYS = new Set(["addon"]);
const FLAG_KEYS = new Set(["json", "force", "help", "yes"]);

export function parseArgs(argv: string[]): Args {
  const [command = "help", ...rest] = argv;
  const values = new Map<string, string>();
  const flags = new Set<string>();
  const lists = new Map<string, string[]>();
  const positionals: string[] = [];

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i]!;
    if (arg === "--") {
      positionals.push(...rest.slice(i + 1));
      break;
    }
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const [key, inline] = arg.slice(2).split("=", 2) as [string, string | undefined];
    if (VALUE_KEYS.has(key)) {
      const value = inline ?? rest[++i];
      if (!value || value.startsWith("--")) throw new Error(`--${key} requires a value`);
      values.set(key, value);
    } else if (LIST_KEYS.has(key)) {
      const value = inline ?? rest[++i];
      if (!value || value.startsWith("--")) throw new Error(`--${key} requires a value`);
      const current = lists.get(key) ?? [];
      current.push(value);
      lists.set(key, current);
    } else if (FLAG_KEYS.has(key)) {
      flags.add(key);
    } else {
      throw new Error(`Unknown option: --${key}`);
    }
  }

  return { command, values, flags, lists, positionals };
}
