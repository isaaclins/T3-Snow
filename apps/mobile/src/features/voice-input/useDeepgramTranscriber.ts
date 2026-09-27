import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import {
  throwIfVoiceTranscriptionAborted,
  VoiceTranscriptionError,
  type VoiceTranscriber,
} from "@t3tools/client-runtime/voice-input";
import type { EnvironmentId } from "@t3tools/contracts";
import { File } from "expo-file-system";
import { useEffect, useMemo, useState } from "react";

import { useCloudVoiceSupported, voiceEnvironment } from "../../state/voice";
import { useAtomCommand } from "../../state/use-atom-command";

/** The device language as an ISO-639-1 code, which Deepgram expects. */
function deviceLanguage(): string {
  return Intl.DateTimeFormat().resolvedOptions().locale.split("-")[0] ?? "";
}

/**
 * T3-Snow cloud dictation: sends the recording to the environment, which
 * transcribes it with the Deepgram key stored there (set in the desktop app's
 * Settings → Voice). Null when the environment has no key.
 */
export function useDeepgramTranscriber(
  environmentId: EnvironmentId | null,
): VoiceTranscriber | null {
  const supported = useCloudVoiceSupported(environmentId);
  const loadStatus = useAtomCommand(voiceEnvironment.status, { reportFailure: false });
  const transcribe = useAtomCommand(voiceEnvironment.transcribe, { reportFailure: false });
  const [keySetFor, setKeySetFor] = useState<EnvironmentId | null>(null);

  useEffect(() => {
    if (!supported || environmentId === null) return;
    let cancelled = false;
    void loadStatus({ environmentId, input: {} }).then((result) => {
      if (cancelled) return;
      setKeySetFor(result._tag === "Success" && result.value.deepgramKeySet ? environmentId : null);
    });
    return () => {
      cancelled = true;
    };
  }, [environmentId, loadStatus, supported]);

  return useMemo(() => {
    if (!supported || environmentId === null || keySetFor !== environmentId) return null;
    const language = deviceLanguage();
    return {
      prepare: async ({ signal }) => {
        throwIfVoiceTranscriptionAborted(signal);
        return {
          locale: language,
          transcribe: async (uri, options) => {
            throwIfVoiceTranscriptionAborted(options.signal);
            const audioBase64 = await new File(uri).base64();
            throwIfVoiceTranscriptionAborted(options.signal);
            // Both platforms record AAC in an MPEG-4 container (.m4a).
            const result = await transcribe({
              environmentId,
              input: { audioBase64, mimeType: "audio/mp4", language },
            });
            throwIfVoiceTranscriptionAborted(options.signal);
            if (result._tag === "Failure") {
              const error = squashAtomCommandFailure(result);
              throw new VoiceTranscriptionError(
                "transcription-failed",
                error instanceof Error ? error.message : "Voice transcription failed.",
                { cause: error },
              );
            }
            if (result.value.text === null) {
              throw new VoiceTranscriptionError(
                "transcription-failed",
                result.value.message ?? "Voice transcription failed.",
              );
            }
            return result.value.text.trim();
          },
        };
      },
    };
  }, [environmentId, keySetFor, supported, transcribe]);
}
