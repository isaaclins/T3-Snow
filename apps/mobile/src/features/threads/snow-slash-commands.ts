import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { useCallback, useMemo } from "react";
import { Alert } from "react-native";

import { autopilotEnvironment, useAutopilotSupported } from "../../state/autopilot";
import { councilEnvironment, useCouncilSupported } from "../../state/council";
import { useAtomCommand } from "../../state/use-atom-command";
import {
  parseAutopilotCommand,
  parseCouncilCommand,
  type SnowCommandSupport,
} from "./snow-slash-commands.logic";

function failureMessage(result: Parameters<typeof squashAtomCommandFailure>[0]): string {
  const error = squashAtomCommandFailure(result);
  return error instanceof Error ? error.message : "Try again.";
}

function confirm(title: string, message: string, action: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: action, onPress: () => resolve(true) },
    ]);
  });
}

/**
 * T3-Snow: `/autopilot` and `/council` in the thread composer. They are handled
 * by T3 Code like on web and never reach the provider. `handle` resolves true
 * when the draft was one of them, whether or not it started.
 */
export function useSnowSlashCommands(input: {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly queueCount: number;
}) {
  const { environmentId, threadId, queueCount } = input;
  const autopilotSupported = useAutopilotSupported(environmentId);
  const councilSupported = useCouncilSupported(environmentId);
  const support = useMemo<SnowCommandSupport>(
    () => ({ autopilot: autopilotSupported, council: councilSupported }),
    [autopilotSupported, councilSupported],
  );
  const startAutopilot = useAtomCommand(autopilotEnvironment.start, { reportFailure: false });
  const prepareCouncil = useAtomCommand(councilEnvironment.prepare, { reportFailure: false });
  const startCouncil = useAtomCommand(councilEnvironment.start, { reportFailure: false });

  const handle = useCallback(
    async (text: string, onHandled: () => void): Promise<boolean> => {
      const councilArgs = support.council ? parseCouncilCommand(text) : null;
      if (councilArgs !== null) {
        const target = { environmentId, input: { threadId, args: councilArgs } };
        const prepared = await prepareCouncil(target);
        if (prepared._tag === "Failure") {
          Alert.alert("Council unavailable", failureMessage(prepared));
          return true;
        }
        if (prepared.value.kind === "info") {
          const [title = "Council", ...rest] = prepared.value.text.split("\n");
          Alert.alert(title, rest.join("\n"));
          return true;
        }
        if (!(await confirm("Convene the council?", prepared.value.text, "Convene"))) return true;
        const started = await startCouncil(target);
        if (started._tag === "Failure") {
          Alert.alert("The council did not sit", failureMessage(started));
          return true;
        }
        if (!started.value.started) {
          Alert.alert("The council did not sit", started.value.message ?? "");
          return true;
        }
        onHandled();
        return true;
      }

      const goal = support.autopilot ? parseAutopilotCommand(text) : null;
      if (goal !== null) {
        if (!goal) {
          Alert.alert("Usage: /autopilot <end goal>");
          return true;
        }
        if (queueCount > 0) {
          Alert.alert("Autopilot can start only when no other agent work is active or queued.");
          return true;
        }
        const result = await startAutopilot({ environmentId, input: { threadId, goal } });
        if (result._tag === "Failure") {
          Alert.alert("Autopilot did not start", failureMessage(result));
          return true;
        }
        if (!result.value.started) {
          Alert.alert(result.value.message ?? "Autopilot did not start");
          return true;
        }
        onHandled();
        if (result.value.message) Alert.alert("Autopilot is on", result.value.message);
        return true;
      }
      return false;
    },
    [
      environmentId,
      prepareCouncil,
      queueCount,
      startAutopilot,
      startCouncil,
      support.autopilot,
      support.council,
      threadId,
    ],
  );

  return useMemo(() => ({ support, handle }), [support, handle]);
}
