import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  SourceInputPanel,
  type SourceInputPanelHandle,
  type SourceInputValue,
} from "./source-input";

/** The panel is fully controlled, so wrap it the way its real parent uses it. */
function Harness({
  initial = { files: [], texts: [], urls: [] },
  onChange,
  onReady,
}: {
  initial?: SourceInputValue;
  onChange?: (value: SourceInputValue) => void;
  onReady?: (handle: SourceInputPanelHandle) => void;
}) {
  const [value, setValue] = useState<SourceInputValue>(initial);

  return (
    <div>
      <SourceInputPanel
        ref={(handle) => {
          if (handle && onReady) onReady(handle);
        }}
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
      />
      <output>{value.urls.length + value.texts.length + value.files.length}</output>
    </div>
  );
}

describe("SourceInputPanel", () => {
  it("shows the source count as things are added", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByRole("status")).toHaveTextContent("0");

    await user.click(screen.getByRole("button", { name: /text/i }));
    await user.type(screen.getByPlaceholderText("Title"), "FAQ");
    await user.type(
      screen.getByPlaceholderText("Paste or write the text content..."),
      "We are open 9 to 5."
    );
    await user.click(screen.getByRole("button", { name: "Add Text Entry" }));

    expect(screen.getByText("1 source ready to add")).toBeInTheDocument();
    expect(screen.getByText("FAQ")).toBeInTheDocument();
  });

  it("keeps Add Text Entry disabled until both fields are filled", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: /text/i }));
    const addButton = screen.getByRole("button", { name: "Add Text Entry" });
    expect(addButton).toBeDisabled();

    await user.type(screen.getByPlaceholderText("Title"), "FAQ");
    expect(addButton).toBeDisabled();

    await user.type(
      screen.getByPlaceholderText("Paste or write the text content..."),
      "Body"
    );
    expect(addButton).toBeEnabled();
  });

  it("adds valid URLs on Enter and rejects invalid ones", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /url/i }));
    const input = screen.getByPlaceholderText("https://example.com/docs");

    await user.type(input, "not a url{Enter}");
    expect(
      screen.getByText(/Enter a full URL starting with http/)
    ).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    await user.clear(input);
    await user.type(input, "https://example.com/docs{Enter}");
    expect(screen.getByText("https://example.com/docs")).toBeInTheDocument();
    expect(screen.queryByText(/Enter a full URL/)).not.toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("removes sources and updates the count", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={{
          files: [],
          texts: [],
          urls: ["https://example.com/a", "https://example.com/b"],
        }}
      />
    );

    expect(screen.getByText("2 sources ready to add")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /url/i }));
    const items = screen.getByText("https://example.com/a").closest("li")!;
    await user.click(within(items).getByRole("button"));

    expect(screen.queryByText("https://example.com/a")).not.toBeInTheDocument();
    expect(screen.getByText("1 source ready to add")).toBeInTheDocument();
  });

  it("commits a typed-but-not-added URL through the imperative handle", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    let handle: SourceInputPanelHandle | null = null;
    render(<Harness onChange={onChange} onReady={(h) => (handle = h)} />);

    await user.click(screen.getByRole("button", { name: /url/i }));
    await user.type(
      screen.getByPlaceholderText("https://example.com/docs"),
      "https://pending.example.com"
    );
    // Not clicked "Add", so the controlled value has not changed yet.
    expect(onChange).not.toHaveBeenCalled();

    const committed = (handle as SourceInputPanelHandle | null)!.commitPending();
    expect(committed.urls).toContain("https://pending.example.com");
    expect(onChange).toHaveBeenCalledWith(committed);
  });
});
