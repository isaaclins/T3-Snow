import { StackActions, useNavigation } from "@react-navigation/native";
import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import { type EnvironmentId, ProjectId, type ProjectIconOverride } from "@t3tools/contracts";
import { useState } from "react";
import { Alert, Pressable, View } from "react-native";

import { SymbolView } from "../../components/AppSymbol";
import { AppText as Text } from "../../components/AppText";
import { uuidv4 } from "../../lib/uuid";
import { useProjects, useServerConfigs } from "../../state/entities";
import { projectEnvironment } from "../../state/projects";
import { useAtomCommand } from "../../state/use-atom-command";

/** Same values as the web app's systemChat.ts, so every client finds the one project. */
const SYSTEM_CHAT_WORKSPACE_ROOT = "~/.t3/system-chat";
const SYSTEM_CHAT_TITLE = "System";
const SYSTEM_CHAT_ICON: ProjectIconOverride = { kind: "lucide", name: "monitor", color: "sky" };

/** The server stores the expanded absolute path, so match on its tail. */
export function isSystemChatWorkspaceRoot(workspaceRoot: string): boolean {
  return /[\\/]\.t3[\\/]system-chat[\\/]?$/.test(workspaceRoot);
}

/**
 * T3-Snow: offers System chat (questions about the machine, no project) in the
 * project picker when a T3-Snow environment has not created its System project
 * yet. Once it exists it is listed like any other project.
 */
export function SnowSystemChatRow(props: {
  readonly preferredEnvironmentId: EnvironmentId | null;
}) {
  const navigation = useNavigation();
  const projects = useProjects();
  const serverConfigs = useServerConfigs();
  const createProject = useAtomCommand(projectEnvironment.create, { reportFailure: false });
  const updateProject = useAtomCommand(projectEnvironment.update, { reportFailure: false });
  const [opening, setOpening] = useState(false);

  // Only T3-Snow servers know about System chat; wake-ups are their marker.
  const candidates = [...serverConfigs.entries()]
    .filter(([, config]) => config.environment.capabilities.deferTriggers === true)
    .map(([environmentId]) => environmentId)
    .filter(
      (environmentId) =>
        !projects.some(
          (project) =>
            project.environmentId === environmentId &&
            isSystemChatWorkspaceRoot(project.workspaceRoot),
        ),
    );
  const environmentId =
    candidates.find((candidate) => candidate === props.preferredEnvironmentId) ?? candidates[0];
  if (environmentId === undefined) return null;

  const open = async () => {
    setOpening(true);
    try {
      const projectId = ProjectId.make(uuidv4());
      const created = await createProject({
        environmentId,
        input: {
          projectId,
          title: SYSTEM_CHAT_TITLE,
          workspaceRoot: SYSTEM_CHAT_WORKSPACE_ROOT,
          createWorkspaceRootIfMissing: true,
          defaultModelSelection: null,
        },
      });
      if (created._tag === "Failure") {
        const error = squashAtomCommandFailure(created);
        Alert.alert(
          "Couldn't open System chat",
          error instanceof Error ? error.message : "Try again.",
        );
        return;
      }
      // Cosmetic: a failed icon update still leaves a working chat.
      await updateProject({ environmentId, input: { projectId, projectIcon: SYSTEM_CHAT_ICON } });
      navigation.dispatch(
        StackActions.push("NewTaskDraft", { environmentId, projectId, title: SYSTEM_CHAT_TITLE }),
      );
    } finally {
      setOpening(false);
    }
  };

  return (
    <View className="overflow-hidden rounded-[24px] bg-card android:rounded-[28px]">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="System chat"
        disabled={opening}
        onPress={() => void open()}
        className="flex-row items-center gap-3 px-4 py-3.5 active:opacity-70 disabled:opacity-50"
      >
        <View className="h-7 w-7 items-center justify-center">
          <SymbolView
            name="desktopcomputer"
            size={18}
            tintColorClassName="accent-icon-muted"
            type="monochrome"
          />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-t3-bold text-base leading-snug">System chat</Text>
          <Text className="text-xs leading-snug text-foreground-muted" numberOfLines={1}>
            Ask about this machine without choosing a project
          </Text>
        </View>
        <SymbolView
          name="chevron.right"
          size={14}
          tintColorClassName="accent-chevron"
          type="monochrome"
        />
      </Pressable>
    </View>
  );
}
