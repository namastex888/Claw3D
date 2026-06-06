import { describe, expect, it } from "vitest";

import { buildAgentOverheadTextState } from "@/features/retro-office/objects/agentOverheadText";

describe("AgentModel nameplate declutter", () => {
  it("can hide idle nameplates while preserving explicit speech bubbles", () => {
    const hiddenIdle = buildAgentOverheadTextState({
      name: "Long Agent Name",
      subtitle: "Hermes profile",
      status: "idle",
      suppressNameplate: true,
    });

    expect(hiddenIdle.showNameplate).toBe(false);
    expect(hiddenIdle.nameplateText).toBe("Long");
    expect(hiddenIdle.subtitleText).toBe("Hermes profile");
    expect(hiddenIdle.activeSpeechBubble).toBe(false);

    const explicitSpeech = buildAgentOverheadTextState({
      name: "Long Agent Name",
      subtitle: "Hermes profile",
      status: "working",
      suppressNameplate: true,
      showSpeech: true,
      speechText: "Working on proof",
    });

    expect(explicitSpeech.showNameplate).toBe(false);
    expect(explicitSpeech.activeSpeechBubble).toBe(true);
    expect(explicitSpeech.speechBubbleDisplayText).toBe("Working on proof");
  });
});
