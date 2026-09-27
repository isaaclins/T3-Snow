import { useNavigation } from "@react-navigation/native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { useSubagentControlSupported } from "../../state/subagentControl";
import { useThreadSelection } from "../../state/use-thread-selection";

/**
 * T3-Snow: a spawn card member that opens its agent sheet (transcript, stop,
 * message) when the environment supports subagent controls. A plain row
 * otherwise.
 */
export function SnowAgentLink(props: {
  readonly taskId: string;
  readonly title: string;
  readonly live: boolean;
  readonly children: ReactNode;
}) {
  const navigation = useNavigation();
  const { selectedThread } = useThreadSelection();
  const supported = useSubagentControlSupported(selectedThread?.environmentId ?? null);
  if (!supported || selectedThread === null || props.taskId === "") {
    return <View className="gap-px">{props.children}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens this agent"
      hitSlop={4}
      onPress={() =>
        navigation.navigate("ThreadAgent", {
          environmentId: String(selectedThread.environmentId),
          threadId: String(selectedThread.id),
          taskId: props.taskId,
          title: props.title,
          ...(props.live ? { live: "1" } : {}),
        })
      }
      className="gap-px active:opacity-60"
    >
      {props.children}
    </Pressable>
  );
}
