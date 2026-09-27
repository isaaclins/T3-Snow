import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentId } from "@t3tools/contracts";
import { useEffect, useState } from "react";
import { Alert, View } from "react-native";

import { AppText as Text, AppTextInput as TextInput } from "../../components/AppText";
import { useCloudVoiceSupported, voiceEnvironment } from "../../state/voice";
import { useAtomCommand } from "../../state/use-atom-command";
import { SettingsActionRow } from "./components/SettingsActionRow";
import { SettingsSection } from "./components/SettingsSection";

/**
 * T3-Snow: the environment's Deepgram key, used for dictation where the phone
 * cannot transcribe on its own. The key stays on the environment; this screen
 * only learns whether one is set.
 */
export function SnowDeepgramKeySection(props: {
  readonly environmentId: EnvironmentId;
  readonly disabled: boolean;
}) {
  const { environmentId } = props;
  const supported = useCloudVoiceSupported(environmentId);
  const loadStatus = useAtomCommand(voiceEnvironment.status, { reportFailure: false });
  const setKey = useAtomCommand(voiceEnvironment.setDeepgramKey, { reportFailure: false });
  const [keySet, setKeySet] = useState<boolean | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    void loadStatus({ environmentId, input: {} }).then((result) => {
      if (!cancelled && result._tag === "Success") setKeySet(result.value.deepgramKeySet);
    });
    return () => {
      cancelled = true;
    };
  }, [environmentId, loadStatus, supported]);

  if (!supported) return null;

  const save = async (apiKey: string | null) => {
    setSaving(true);
    const result = await setKey({ environmentId, input: { apiKey } });
    setSaving(false);
    if (result._tag === "Failure") {
      const error = squashAtomCommandFailure(result);
      Alert.alert("Couldn't save the key", error instanceof Error ? error.message : "Try again.");
      return;
    }
    setKeySet(result.value.deepgramKeySet);
    if (result.value.message) {
      Alert.alert("Couldn't save the key", result.value.message);
      return;
    }
    setDraft("");
  };

  return (
    <SettingsSection title="Dictation">
      <View className="gap-2 p-4">
        <Text className="text-base text-foreground">Deepgram key</Text>
        <Text className="text-sm leading-normal text-foreground-muted">
          {keySet === null
            ? "Checking…"
            : keySet
              ? "Set. Dictation on phones without on-device transcription goes through Deepgram."
              : "Not set. Add one to dictate on Android and older iPhones."}
        </Text>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={keySet ? "Replace the key" : "Paste a Deepgram API key"}
          accessibilityLabel="Deepgram API key"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          editable={!props.disabled && !saving}
          className="rounded-[14px] bg-subtle px-3 py-2.5 text-sm text-foreground"
        />
      </View>
      <SettingsActionRow
        icon="checkmark"
        label="Save key"
        disabled={props.disabled || saving || !draft.trim()}
        loading={saving && draft.trim() !== ""}
        onPress={() => void save(draft.trim())}
      />
      {keySet ? (
        <SettingsActionRow
          icon="trash"
          label="Remove key"
          tone="danger"
          disabled={props.disabled || saving}
          onPress={() => void save(null)}
        />
      ) : null}
    </SettingsSection>
  );
}
