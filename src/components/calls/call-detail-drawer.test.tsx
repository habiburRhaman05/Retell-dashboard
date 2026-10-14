import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CallDetailDrawer } from "./call-detail-drawer";
import type { RetellCall } from "@/types/retell";

const useCallDetailMock = vi.fn();
vi.mock("@/hooks/use-calls", () => ({
  useCallDetail: (...args: unknown[]) => useCallDetailMock(...args),
}));

const onClose = vi.fn();

function call(overrides: Partial<RetellCall> = {}): RetellCall {
  return {
    call_id: "call_1",
    agent_id: "a1",
    agent_name: "Support Agent",
    call_status: "ended",
    call_type: "web_call",
    start_timestamp: Date.parse("2026-10-14T02:38:00Z"),
    duration_ms: 6000,
    call_cost: { combined_cost: 3.4 },
    call_analysis: {
      call_successful: true,
      user_sentiment: "Neutral",
      call_summary: "The agent greeted the caller.",
    },
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("CallDetailDrawer", () => {
  it("shows a loading state", () => {
    useCallDetailMock.mockReturnValue({ data: undefined, isLoading: true, error: null });
    render(<CallDetailDrawer callId="call_1" onClose={onClose} />);
    expect(screen.getByText("Loading call...")).toBeInTheDocument();
  });

  it("shows an error state", () => {
    useCallDetailMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Call not found"),
    });
    render(<CallDetailDrawer callId="call_1" onClose={onClose} />);
    expect(screen.getByText("Could not load this call")).toBeInTheDocument();
    expect(screen.getByText("Call not found")).toBeInTheDocument();
  });

  it("renders call metadata, analysis and summary on the happy path", () => {
    useCallDetailMock.mockReturnValue({
      data: { call: call(), logLines: [] },
      isLoading: false,
      error: null,
    });
    render(<CallDetailDrawer callId="call_1" onClose={onClose} />);

    expect(screen.getByText(/Agent: Support Agent/)).toBeInTheDocument();
    expect(screen.getByText(/Call ID: call_1/)).toBeInTheDocument();
    expect(screen.getByText("Successful")).toBeInTheDocument();
    expect(screen.getByText("The agent greeted the caller.")).toBeInTheDocument();
  });

  it("shows an empty transcript state and switches to the Data and Detail Logs tabs", async () => {
    const user = userEvent.setup();
    useCallDetailMock.mockReturnValue({
      data: { call: call({ metadata: { foo: "bar" } }), logLines: ["log line one"] },
      isLoading: false,
      error: null,
    });
    render(<CallDetailDrawer callId="call_1" onClose={onClose} />);

    expect(screen.getByText("No transcript available for this call.")).toBeInTheDocument();

    await user.click(screen.getByText("Data"));
    expect(screen.getByText(/"foo": "bar"/)).toBeInTheDocument();

    await user.click(screen.getByText("Detail Logs"));
    expect(screen.getByText("log line one")).toBeInTheDocument();
  });

  it("renders transcript turns when transcript_object is present", () => {
    useCallDetailMock.mockReturnValue({
      data: {
        call: call({
          transcript_object: [
            { role: "agent", content: "Hi there" },
            { role: "user", content: "Hello" },
          ],
        }),
        logLines: [],
      },
      isLoading: false,
      error: null,
    });
    render(<CallDetailDrawer callId="call_1" onClose={onClose} />);
    expect(screen.getByText("Hi there")).toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const user = userEvent.setup();
    useCallDetailMock.mockReturnValue({
      data: { call: call(), logLines: [] },
      isLoading: false,
      error: null,
    });
    render(<CallDetailDrawer callId="call_1" onClose={onClose} />);
    await user.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalled();
  });
});
