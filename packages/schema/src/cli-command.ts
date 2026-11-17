/** Builds a reproducible `launchbed new` invocation that matches a request. */
export function formatNewCommand(options: {
  projectName: string;
  applicationId: string;
  preset?: string;
  addons?: readonly string[];
  out?: string;
}): string {
  const parts = ["launchbed new"];
  parts.push("--name", shellQuote(options.projectName));
  parts.push("--app-id", options.applicationId);
  if (options.preset) {
    parts.push("--preset", options.preset);
  }
  const addons = [...(options.addons ?? [])].sort();
  for (const addon of addons) {
    parts.push("--addon", addon);
  }
  if (options.out) {
    parts.push("--out", options.out);
  }
  return parts.join(" ");
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
}
