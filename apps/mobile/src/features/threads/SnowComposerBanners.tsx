import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import {
  type AtomCommandResult,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { memo, useEffect, useState, type ReactNode } from "react";
import { Alert, Pressable, View } from "react-native";

import { type AppSymbolName, SymbolView } from "../../components/AppSymbol";
import { AppText as Text } from "../../components/AppText";
import { cn } from "../../lib/cn";
import { autopilotEnvironment, useThreadAutopilot } from "../../state/autopilot";
import { councilEnvironment, useThreadCouncil } from "../../state/council";
import { deferEnvironment, useThreadDeferTriggers } from "../../state/defer";
import { useAtomCommand } from "../../state/use-atom-command";
import {
  deferTriggerState,
  describeCouncilSeat,
  describeDeferStatus,
  formatDeferDuration,
} from "./snow-banners.logic";

/**
 * T3-Snow: the thread's armed wake-ups, Autopilot and sitting council, docked
 * above the composer like the web app shows them. Each hides itself when idle.
 */
export const SnowComposerBanners = memo(function SnowComposerBanners({
  environmentId,
  threadId,
}: {
  readonly environmentId: EnvironmentId | null;
  readonly threadId: ThreadId | null;
}) {
  return (
    <>
      <CouncilBanner environmentId={environmentId} threadId={threadId} />
      <AutopilotBanner environmentId={environmentId} threadId={threadId} />
      <DeferBanner environmentId={environmentId} threadId={threadId} />
    </>
  );
});

async function reportFailure(
  result: Promise<AtomCommandResult<unknown, unknown>>,
  title: string,
): Promise<void> {
  const settled = await result;
  if (settled._tag !== "Failure") return;
  const error = squashAtomCommandFailure(settled);
  Alert.alert(title, error instanceof Error ? error.message : "Try again.");
}

/** Re-renders once a second while `active`, for countdowns. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(interval);
  }, [active]);
  return now;
}

function BannerCard({ children }: { readonly children: ReactNode }) {
  // Opaque like the other composer cards: nothing blurs the feed behind it.
  return (
    <View className="px-4 pb-3">
      <View className="gap-2 rounded-[20px] border border-border bg-card-alt px-4 py-3">
        {children}
      </View>
    </View>
  );
}

function BannerHeader({
  icon,
  title,
  detail,
  children,
}: {
  readonly icon: AppSymbolName;
  readonly title: string;
  readonly detail?: string;
  readonly children?: ReactNode;
}) {
  return (
    <View className="flex-row items-center gap-2">
      <SymbolView name={icon} size={14} tintColorClassName="accent-icon-muted" type="monochrome" />
      <Text className="shrink-0 font-t3-bold text-sm text-foreground">{title}</Text>
      <Text className="min-w-0 flex-1 text-sm text-foreground-muted" numberOfLines={1}>
        {detail ?? ""}
      </Text>
      {children}
    </View>
  );
}

function BannerButton({
  label,
  onPress,
}: {
  readonly label: string;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      className="rounded-[10px] bg-subtle-strong px-2.5 py-1 active:opacity-60"
    >
      <Text className="font-t3-bold text-xs text-foreground">{label}</Text>
    </Pressable>
  );
}

function DeferBanner({
  environmentId,
  threadId,
}: {
  readonly environmentId: EnvironmentId | null;
  readonly threadId: ThreadId | null;
}) {
  const triggers = useThreadDeferTriggers(environmentId, threadId);
  const cancel = useAtomCommand(deferEnvironment.cancel, { reportFailure: false });
  const now = useNow(triggers.length > 0);
  if (triggers.length === 0 || environmentId === null) return null;

  return (
    <BannerCard>
      <BannerHeader icon="clock" title="Wake-ups" detail={`${triggers.length} armed`} />
      {triggers.map((trigger) => {
        const state = deferTriggerState(trigger);
        return (
          <View key={trigger.id} className="flex-row items-center gap-2">
            <Text className="min-w-0 flex-1 text-xs text-foreground-secondary" numberOfLines={1}>
              {trigger.note}
              {trigger.run ? " →run" : ""}
            </Text>
            <Text
              className={cn(
                "text-xs tabular-nums text-foreground-muted",
                state === "broken" && "text-warning-foreground",
              )}
            >
              {describeDeferStatus(trigger, now)}
            </Text>
            <Pressable
              accessibilityLabel={`Cancel wake-up ${trigger.id}`}
              accessibilityRole="button"
              hitSlop={10}
              onPress={() =>
                void reportFailure(
                  cancel({ environmentId, input: { triggerId: trigger.id } }),
                  "Couldn't cancel the wake-up",
                )
              }
              className="p-1 active:opacity-60"
            >
              <SymbolView
                name="xmark"
                size={12}
                tintColorClassName="accent-icon-muted"
                type="monochrome"
              />
            </Pressable>
          </View>
        );
      })}
    </BannerCard>
  );
}

function AutopilotBanner({
  environmentId,
  threadId,
}: {
  readonly environmentId: EnvironmentId | null;
  readonly threadId: ThreadId | null;
}) {
  const autopilot = useThreadAutopilot(environmentId, threadId);
  const stop = useAtomCommand(autopilotEnvironment.stop, { reportFailure: false });
  const resume = useAtomCommand(autopilotEnvironment.resume, { reportFailure: false });
  if (!autopilot || environmentId === null || threadId === null) return null;
  const paused = autopilot.status === "paused";

  return (
    <BannerCard>
      <BannerHeader
        icon="bolt.circle"
        title={paused ? "Autopilot paused" : "Autopilot"}
        detail={autopilot.goal}
      >
        {paused ? (
          <BannerButton
            label="Resume"
            onPress={() =>
              void reportFailure(
                resume({ environmentId, input: { threadId } }),
                "Couldn't resume Autopilot",
              )
            }
          />
        ) : null}
        <BannerButton
          label="Stop"
          onPress={() =>
            void reportFailure(
              stop({ environmentId, input: { threadId } }),
              "Couldn't stop Autopilot",
            )
          }
        />
      </BannerHeader>
    </BannerCard>
  );
}

function CouncilBanner({
  environmentId,
  threadId,
}: {
  readonly environmentId: EnvironmentId | null;
  readonly threadId: ThreadId | null;
}) {
  const council = useThreadCouncil(environmentId, threadId);
  const cancel = useAtomCommand(councilEnvironment.cancel, { reportFailure: false });
  const now = useNow(council !== null);
  if (!council || environmentId === null || threadId === null) return null;

  return (
    <BannerCard>
      <BannerHeader
        icon="brain"
        title="Council"
        detail={`${council.phase} · ${formatDeferDuration(now - Date.parse(council.startedAt))} · ${council.model}`}
      >
        <BannerButton
          label="Cancel"
          onPress={() =>
            void reportFailure(
              cancel({ environmentId, input: { threadId } }),
              "Couldn't cancel the council",
            )
          }
        />
      </BannerHeader>
      {council.seats.map((seat) => (
        <View key={seat.id} className="flex-row items-center gap-2">
          <Text className="w-6 text-xs">{seat.icon}</Text>
          <Text className="w-20 text-xs text-foreground-secondary" numberOfLines={1}>
            {seat.name}
          </Text>
          <Text
            className={cn(
              "min-w-0 flex-1 text-xs text-foreground-muted",
              seat.status === "failed" && "text-warning-foreground",
            )}
            numberOfLines={1}
          >
            {describeCouncilSeat(seat)}
          </Text>
        </View>
      ))}
    </BannerCard>
  );
}
