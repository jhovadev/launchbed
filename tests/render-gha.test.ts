import { describe, expect, test } from "bun:test";
import { LaunchbedError } from "@launchbed/schema";
import { renderText } from "@launchbed/generator";

describe("GitHub Actions expression escape", () => {
  test("renders {{gha:expr}} to ${{ expr }} and keeps other vars", () => {
    const rendered = renderText(
      "group: {{gha:github.workflow}}-{{gha:github.ref}}\npath: {{file}}\n",
      { file: "app-debug.apk" },
      "workflow",
    );
    expect(rendered).toBe("group: ${{ github.workflow }}-${{ github.ref }}\npath: app-debug.apk\n");
  });

  test("rejects secrets and leftover placeholders", () => {
    expect(() => renderText("{{gha:secrets.TOKEN}}", {}, "workflow")).toThrow(LaunchbedError);
    expect(() => renderText("{{unknown}}", {}, "workflow")).toThrow(LaunchbedError);
  });
});
