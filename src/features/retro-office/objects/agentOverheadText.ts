import type { OfficeAgent } from "@/features/retro-office/core/types";

const MAX_NAMEPLATE_TEXT_LENGTH = 10;
const MAX_SPEECH_BUBBLE_TEXT_LENGTH = 180;

const formatAgentNameplateText = (value: string): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= MAX_NAMEPLATE_TEXT_LENGTH) return normalized;
  const [firstName] = normalized.split(" ");
  return firstName || normalized;
};

const flattenSpeechBubbleMarkdown = (value: string) =>
  value
    .replace(/```[\s\S]*?```/g, " [code] ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^>\s*/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const clampSpeechBubbleText = (value: string) => {
  if (value.length <= MAX_SPEECH_BUBBLE_TEXT_LENGTH) {
    return { text: value, truncated: false };
  }
  const slice = value.slice(0, MAX_SPEECH_BUBBLE_TEXT_LENGTH - 1).trimEnd();
  return { text: `${slice}…`, truncated: true };
};

export type AgentOverheadTextState = {
  activeSpeechBubble: boolean;
  nameplateText: string;
  showNameplate: boolean;
  speechBubbleDisplayText: string;
  speechBubbleWasTruncated: boolean;
  subtitleText: string;
};

export const buildAgentOverheadTextState = ({
  name,
  speechText = null,
  showSpeech = false,
  status,
  subtitle,
  suppressNameplate = false,
}: {
  name: string;
  speechText?: string | null;
  showSpeech?: boolean;
  status: OfficeAgent["status"];
  subtitle?: string | null;
  suppressNameplate?: boolean;
}): AgentOverheadTextState => {
  const resolvedSpeechText =
    showSpeech && speechText?.trim()
      ? speechText.trim()
      : status === "error"
        ? "error"
        : "...";
  const activeSpeechBubble = showSpeech && Boolean(speechText?.trim());
  const normalizedSpeechBubbleText = activeSpeechBubble
    ? flattenSpeechBubbleMarkdown(resolvedSpeechText)
    : resolvedSpeechText;
  const speechBubblePreview = activeSpeechBubble
    ? clampSpeechBubbleText(normalizedSpeechBubbleText)
    : { text: normalizedSpeechBubbleText, truncated: false };
  const nameplateText = name ? formatAgentNameplateText(name) : "";
  const subtitleText = typeof subtitle === "string" ? subtitle.trim() : "";

  return {
    activeSpeechBubble,
    nameplateText,
    showNameplate: !suppressNameplate && !activeSpeechBubble && Boolean(nameplateText),
    speechBubbleDisplayText: speechBubblePreview.text,
    speechBubbleWasTruncated: speechBubblePreview.truncated,
    subtitleText,
  };
};
