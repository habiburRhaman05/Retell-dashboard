import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CallHistory } from "./call-history";
import type { RetellCall } from "@/types/retell";

const toastMock = vi.fn();
vi.mock("@/components/layout/toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

const refetchMock = vi.fn();
const useCallHistoryMock = vi.fn();
vi.mock("@/hooks/use-calls", () => ({
  useCallHistory: (...args: unknown[]) => useCallHistoryMock(...args),
}));

vi.mock("./call-detail-drawer", () => ({
  CallDetailDrawer: ({ callId, onClose }: { callId: string; onClose: () => void }) => (
    <div>
      <span>drawer open: {callId}</span>
      <button onClick={onClose}>close drawer</button>
    </div>
  ),
}));

function call(overrides: Partial<RetellCall> = {}): RetellCall {
  return {
    call_id: "call_1",
    agent_id: "a1",
    call_status: "ended",
    call_type: "web_call",
    start_timestamp: Date.parse("2026-10-14T02:38:00Z"),
    duration_ms: 6000,
    call_cost: { combined_cost: 3.4 },
    disconnection_reason: "user_hangup",
    call_analysis: { user_sentiment: "Neutral", call_successful: true },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("CallHistory", () => {
  it("shows a loading state", () => {
    useCallHistoryMock.mockReturnValue({ data: undefined, isLoading: true, error: null, refetch: refetchMock });
    render(<CallHistory />);
    expect(screen.getByText("Loading call history...")).toBeInTheDocument();
  });

  it("shows an error state with a working retry button", async () => {
    const user = userEvent.setup();
    useCallHistoryMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Request failed (500)"),
      refetch: refetchMock,
    });
    render(<CallHistory />);
    expect(screen.getByText("Failed to load call history")).toBeInTheDocument();
    expect(screen.getByText("Request failed (500)")).toBeInTheDocument();
    await user.click(screen.getByText("Retry"));
    expect(refetchMock).toHaveBeenCalled();
  });

  it("shows an empty state when there are no calls", () => {
    useCallHistoryMock.mockReturnValue({
      data: { items: [], page: 1, pageSize: 50, total: 0, hasMore: false },
      isLoading: false,
      error: null,
      refetch: refetchMock,
    });
    render(<CallHistory />);
    expect(screen.getByText("No calls in this range")).toBeInTheDocument();
  });

  it("renders call rows with formatted columns and pagination info", () => {
    useCallHistoryMock.mockReturnValue({
      data: { items: [call()], page: 1, pageSize: 50, total: 54, hasMore: true },
      isLoading: false,
      error: null,
      refetch: refetchMock,
    });
    render(<CallHistory />);

    expect(screen.getByText("0:06")).toBeInTheDocument();
    expect(screen.getByText("$0.034")).toBeInTheDocument();
    expect(screen.getByText("user_hangup")).toBeInTheDocument();
    expect(screen.getByText(/Total Session: 54/)).toBeInTheDocument();
    expect(screen.getByText("Next")).not.toBeDisabled();
    expect(screen.getByText("Prev")).toBeDisabled();
  });

  it("opens the detail drawer when a row is clicked", async () => {
    const user = userEvent.setup();
    useCallHistoryMock.mockReturnValue({
      data: { items: [call()], page: 1, pageSize: 50, total: 1, hasMore: false },
      isLoading: false,
      error: null,
      refetch: refetchMock,
    });
    render(<CallHistory />);

    await user.click(screen.getByText("call_1"));
    expect(screen.getByText("drawer open: call_1")).toBeInTheDocument();

    await user.click(screen.getByText("close drawer"));
    expect(screen.queryByText(/drawer open/)).not.toBeInTheDocument();
  });

  it("toggles a column's visibility from the column settings menu", async () => {
    const user = userEvent.setup();
    useCallHistoryMock.mockReturnValue({
      data: { items: [call()], page: 1, pageSize: 50, total: 1, hasMore: false },
      isLoading: false,
      error: null,
      refetch: refetchMock,
    });
    render(<CallHistory />);

    expect(screen.getByText("user_hangup")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Column settings"));
    await user.click(screen.getByLabelText("End Reason"));

    expect(screen.queryByText("user_hangup")).not.toBeInTheDocument();
  });

  it("tracks row selection and reflects it in the selected count", async () => {
    const user = userEvent.setup();
    useCallHistoryMock.mockReturnValue({
      data: { items: [call()], page: 1, pageSize: 50, total: 1, hasMore: false },
      isLoading: false,
      error: null,
      refetch: refetchMock,
    });
    render(<CallHistory />);

    const table = screen.getByRole("table");
    const checkbox = within(table).getAllByRole("checkbox")[1];
    await user.click(checkbox);

    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });
});
