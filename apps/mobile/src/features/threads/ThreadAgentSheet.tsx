import { useNavigation, type StaticScreenProps } from "@react-navigation/native";
import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import {
  EnvironmentId,
  type SubagentControlResult,
  type SubagentTranscriptEntry,
  type SubagentTranscriptResult,
  ThreadId,
} from "@t3tools/contracts";
import type { AtomCommandResult } from "@t3tools/client-runtime/state/runtime";
import { useCallback, useEffect, useState } from "react";
import { Alert, Platform, ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AndroidSheetHeader } from "../../components/AndroidScreenHeader";
import { AppText as Text, AppTextInput as TextInput } from "../../components/AppText";
import { MaterialScreenContent } from "../../components/MaterialScreenContent";
import { cn } from "../../lib/cn";
import { NativeStackScreenOptions } from "../../native/StackHeader";
import { subagentControlEnvironment } from "../../state/subagentControl";
import { useAtomCommand } from "../../state/use-atom-command";
import { RequestActionButton } from "./RequestActionButton";

type ThreadAgentSheetProps = StaticScreenProps<{
  readonly environmentId: string;
  readonly threadId: string;
  readonly taskId: string;
  readonly title: string;
  /** "1" while the agent is still working, so Stop is offered. */
  readonly live?: string;
}>;

function TranscriptEntry({ entry }: { readonly entry: SubagentTranscriptEntry }) {
  switch (entry.kind) {
    case "tool":
      return (
        <Text className="font-mono text-2xs text-foreground-muted" numberOfLines={2}>
          <Text className="font-mono text-2xs text-adaptive-sky-600-400">▸ {entry.toolName} </Text>
          {entry.text}
        </Text>
      );
    case "tool-result":
      return (
        <Text
          className="border-l border-border pl-2 font-mono text-2xs text-foreground-muted"
          numberOfLines={4}
        >
          {entry.text}
        </Text>
      );
    case "thinking":
      return (
        <Text className="text-xs italic text-foreground-muted" numberOfLines={6}>
          {entry.text}
        </Text>
      );
    case "prompt":
      return (
        <Text className="rounded-lg bg-subtle px-2 py-1 text-xs text-foreground" numberOfLines={6}>
          {entry.text}
        </Text>
      );
    case "text":
      return (
        <Text selectable className="text-sm leading-normal text-foreground">
          {entry.text}
        </Text>
      );
  }
}

/**
 * T3-Snow: one native subagent, opened from its spawn card. Shows its
 * transcript (when the provider keeps one), and lets the user stop it or send
 * it a message through the main agent.
 */
export function ThreadAgentSheet(props: ThreadAgentSheetProps) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { taskId, title } = props.route.params;
  const environmentId = EnvironmentId.make(props.route.params.environmentId);
  const threadId = ThreadId.make(props.route.params.threadId);
  const live = props.route.params.live === "1";

  const loadTranscript = useAtomCommand(subagentControlEnvironment.transcript, {
    reportFailure: false,
  });
  const stop = useAtomCommand(subagentControlEnvironment.stop, { reportFailure: false });
  const sendMessage = useAtomCommand(subagentControlEnvironment.message, { reportFailure: false });
  const [transcript, setTranscript] = useState<SubagentTranscriptResult | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const result = await loadTranscript({ environmentId, input: { threadId, taskId } });
    if (result._tag === "Success") setTranscript(result.value);
  }, [environmentId, loadTranscript, taskId, threadId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const report = (
    failureTitle: string,
    result: AtomCommandResult<SubagentControlResult, unknown>,
  ) => {
    if (result._tag === "Failure") {
      const error = squashAtomCommandFailure(result);
      Alert.alert(failureTitle, error instanceof Error ? error.message : "Try again.");
      return false;
    }
    if (!result.value.ok) {
      Alert.alert(failureTitle, result.value.message ?? "");
      return false;
    }
    return true;
  };

  const onStop = async () => {
    setBusy(true);
    const stopped = report(
      "Couldn't stop the agent",
      await stop({ environmentId, input: { threadId, taskId } }),
    );
    setBusy(false);
    if (stopped) navigation.goBack();
  };

  const onSend = async () => {
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    const sent = report(
      "Couldn't send the message",
      await sendMessage({ environmentId, input: { threadId, taskId, title, text } }),
    );
    setBusy(false);
    if (sent) {
      setDraft("");
      Alert.alert("Sent to the main agent", "It passes your message on to this agent.");
    }
  };

  const entries = transcript?.entries ?? null;
  return (
    <View
      collapsable={false}
      className="bg-sheet ios:flex-1"
      style={Platform.OS === "android" ? { maxHeight: windowHeight * 0.92 } : undefined}
    >
      {Platform.OS === "android" ? (
        <NativeStackScreenOptions
          options={{ sheetCornerRadius: 28, sheetAllowedDetents: "fitToContents" }}
        />
      ) : null}
      {Platform.OS === "android" ? (
        <AndroidSheetHeader title={title} onBack={() => navigation.goBack()} hideBottomBorder />
      ) : null}
      <MaterialScreenContent fitToContents>
        <ScrollView
          className="android:shrink android:grow-0 ios:flex-1"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentInset={{ bottom: Math.max(insets.bottom, 18) + 18 }}
          contentContainerClassName="gap-4 px-5 pt-4"
          contentContainerStyle={
            Platform.OS === "android"
              ? { paddingBottom: Math.max(insets.bottom, 18) + 18 }
              : undefined
          }
        >
          {Platform.OS === "ios" ? (
            <Text className="font-t3-bold text-lg text-foreground" numberOfLines={2}>
              {title}
            </Text>
          ) : null}
          <View className="gap-2 rounded-[20px] border border-border bg-card p-4">
            {entries && entries.length > 0 ? (
              <>
                {transcript && transcript.omitted > 0 ? (
                  <Text className="text-2xs text-foreground-muted">
                    {transcript.omitted} earlier steps not shown
                  </Text>
                ) : null}
                {entries.map((entry, index) => (
                  <TranscriptEntry key={index} entry={entry} />
                ))}
              </>
            ) : (
              <Text className="text-sm text-foreground-muted">
                {transcript === null
                  ? "Loading…"
                  : entries === null
                    ? "This provider keeps no readable transcript for its agents."
                    : "Nothing to show yet."}
              </Text>
            )}
          </View>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message this agent…"
            accessibilityLabel={`Message ${title}`}
            multiline
            className={cn(
              "min-h-12 rounded-[16px] border border-border bg-card px-4 py-3 text-sm text-foreground",
            )}
          />
          <View className="flex-row flex-wrap gap-2.5">
            <RequestActionButton
              label="Send"
              disabled={busy || !draft.trim()}
              onPress={() => void onSend()}
            />
            <RequestActionButton
              label="Refresh"
              tone="secondary"
              disabled={busy}
              onPress={() => void refresh()}
            />
            {live ? (
              <RequestActionButton
                label="Stop"
                tone="danger"
                disabled={busy}
                onPress={() => void onStop()}
              />
            ) : null}
          </View>
        </ScrollView>
      </MaterialScreenContent>
    </View>
  );
}
