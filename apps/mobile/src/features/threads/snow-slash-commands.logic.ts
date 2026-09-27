import type { ComposerCommandItem } from "./ComposerCommandPopover";

/** T3-Snow: the arguments of a `/council …` message (empty when none), or null. */
export function parseCouncilCommand(text: string): string | null {
  const match = /^\/council(?:\s+([\s\S]*))?$/i.exec(text.trim());
  return match ? (match[1] ?? "").trim() : null;
}

/** T3-Snow: the goal of an `/autopilot <goal>` message (empty when none), or null. */
export function parseAutopilotCommand(text: string): string | null {
  const match = /^\/autopilot(?:\s+([\s\S]*))?$/i.exec(text.trim());
  return match ? (match[1] ?? "").trim() : null;
}

export interface SnowCommandSupport {
  readonly autopilot: boolean;
  readonly council: boolean;
}

/** Menu entries for the T3-Snow commands the environment supports. */
export function snowSlashCommandItems(
  query: string,
  support: SnowCommandSupport,
): ComposerCommandItem[] {
  const items: ComposerCommandItem[] = [];
  if (support.autopilot) {
    items.push({
      id: "cmd:autopilot",
      type: "slash-command",
      command: "autopilot",
      label: "/autopilot",
      description: "Work on a goal alone until it is done",
    });
  }
  if (support.council) {
    items.push({
      id: "cmd:council",
      type: "slash-command",
      command: "council",
      label: "/council",
      description: "Four advisors debate an idea and a chair decides",
    });
  }
  return items.filter((item) => item.type === "slash-command" && item.command.includes(query));
}
