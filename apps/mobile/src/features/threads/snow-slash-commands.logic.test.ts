import { describe, expect, it } from "vite-plus/test";

import {
  parseAutopilotCommand,
  parseCouncilCommand,
  snowSlashCommandItems,
} from "./snow-slash-commands.logic";

describe("snow slash commands", () => {
  it("parses the goal and the council idea", () => {
    expect(parseAutopilotCommand("/autopilot  ship the release \n")).toBe("ship the release");
    expect(parseAutopilotCommand("/Autopilot")).toBe("");
    expect(parseAutopilotCommand("/autopilotx go")).toBeNull();
    expect(parseAutopilotCommand("please /autopilot go")).toBeNull();
    expect(parseCouncilCommand("/council should we\nrewrite it?")).toBe("should we\nrewrite it?");
    expect(parseCouncilCommand("/council")).toBe("");
  });

  it("offers only what the environment supports, filtered by the query", () => {
    const ids = (query: string, autopilot: boolean, council: boolean) =>
      snowSlashCommandItems(query, { autopilot, council }).map((item) => item.id);
    expect(ids("", true, true)).toEqual(["cmd:autopilot", "cmd:council"]);
    expect(ids("co", true, true)).toEqual(["cmd:council"]);
    expect(ids("", false, true)).toEqual(["cmd:council"]);
    expect(ids("", false, false)).toEqual([]);
  });
});
