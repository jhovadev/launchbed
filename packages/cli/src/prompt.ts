import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export async function promptLine(question: string, fallback = ""): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    const suffix = fallback ? ` [${fallback}]` : "";
    const answer = await rl.question(`${question}${suffix}: `);
    const trimmed = answer.trim();
    return trimmed === "" ? fallback : trimmed;
  } finally {
    rl.close();
  }
}

export async function promptList(question: string, options: readonly { id: string; label: string }[], fallback = ""): Promise<string> {
  for (const [index, option] of options.entries()) {
    console.log(`  ${index + 1}. ${option.id} — ${option.label}`);
  }
  const answer = await promptLine(question, fallback);
  const asNumber = Number(answer);
  if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= options.length) {
    return options[asNumber - 1]!.id;
  }
  return answer;
}
