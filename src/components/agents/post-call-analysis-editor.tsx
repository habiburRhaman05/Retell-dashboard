"use client";

import { useState } from "react";
import { Plus, Pencil, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PostCallAnalysisItem, PostCallAnalysisFieldType } from "@/types/retell";

const TYPE_LABELS: Record<PostCallAnalysisFieldType, string> = {
  string: "Text",
  boolean: "Yes / No",
  number: "Number",
  enum: "Multiple Choice",
};

export function PostCallAnalysisEditor({
  items,
  onSave,
  isSaving,
}: {
  items: PostCallAnalysisItem[];
  onSave: (items: PostCallAnalysisItem[]) => void;
  isSaving?: boolean;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const startAdd = () => {
    setEditingIndex(null);
    setShowForm(true);
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setShowForm(true);
  };

  const handleSubmit = (item: PostCallAnalysisItem) => {
    if (editingIndex === null) {
      onSave([...items, item]);
    } else {
      onSave(items.map((it, i) => (i === editingIndex ? item : it)));
    }
    setShowForm(false);
    setEditingIndex(null);
  };

  const removeItem = (index: number) => {
    onSave(items.filter((_, i) => i !== index));
  };

  return (
    <div className="px-4 py-3">
      <p className="text-[11px] text-gray-400 mb-3">
        Define structured data to extract from each call transcript after it ends.
      </p>

      {items.length > 0 ? (
        <div className="space-y-2 mb-3">
          {items.map((item, i) => (
            <div
              key={i}
              className="flex items-start justify-between gap-2 px-3 py-2.5 rounded-lg bg-gray-50"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[12px] font-medium text-gray-700">
                    {item.name}
                  </p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-500">
                    {TYPE_LABELS[item.type] || item.type}
                  </span>
                </div>
                {item.description && (
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {item.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => startEdit(i)}
                  className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => removeItem(i)}
                  className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-red-500"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !showForm && (
          <p className="text-[12px] text-gray-400 text-center py-3">
            No post-call analysis fields configured
          </p>
        )
      )}

      {showForm ? (
        <AnalysisItemForm
          initial={editingIndex !== null ? items[editingIndex] : undefined}
          existingNames={items
            .filter((_, i) => i !== editingIndex)
            .map((it) => it.name)}
          onCancel={() => {
            setShowForm(false);
            setEditingIndex(null);
          }}
          onSubmit={handleSubmit}
          isSaving={isSaving}
        />
      ) : (
        <button
          onClick={startAdd}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 text-[12px] font-medium hover:bg-gray-200 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Field
        </button>
      )}
    </div>
  );
}

function AnalysisItemForm({
  initial,
  existingNames,
  onSubmit,
  onCancel,
  isSaving,
}: {
  initial?: PostCallAnalysisItem;
  existingNames: string[];
  onSubmit: (item: PostCallAnalysisItem) => void;
  onCancel: () => void;
  isSaving?: boolean;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [type, setType] = useState<PostCallAnalysisFieldType>(initial?.type || "string");
  const [choicesInput, setChoicesInput] = useState((initial?.choices || []).join(", "));
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required");
      return;
    }
    if (existingNames.some((n) => n.toLowerCase() === trimmedName.toLowerCase())) {
      setError(`"${trimmedName}" is already used`);
      return;
    }
    if (!description.trim()) {
      setError("Description is required so the model knows what to extract");
      return;
    }
    const choices = choicesInput
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    if (type === "enum" && choices.length < 2) {
      setError("Add at least 2 choices, separated by commas");
      return;
    }
    setError(null);
    onSubmit({
      name: trimmedName,
      description: description.trim(),
      type,
      ...(type === "enum" ? { choices } : {}),
    });
  };

  return (
    <div className="rounded-lg border border-gray-200 p-3 space-y-2.5 bg-white">
      <input
        type="text"
        placeholder="Field name, e.g. call_summary"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError(null);
        }}
        className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 text-[12px] text-gray-700 placeholder:text-gray-400 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
      />
      <textarea
        placeholder="Describe what to extract, e.g. A 2-sentence summary of the call"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 text-[12px] text-gray-700 placeholder:text-gray-400 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 resize-none"
      />
      <div className="flex gap-1.5">
        {(Object.keys(TYPE_LABELS) as PostCallAnalysisFieldType[]).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={cn(
              "px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors",
              type === t
                ? "border-cyan-500 bg-cyan-50 text-cyan-600"
                : "border-gray-200 text-gray-500 hover:border-gray-300"
            )}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>
      {type === "enum" && (
        <input
          type="text"
          placeholder="Choices, comma separated: positive, neutral, negative"
          value={choicesInput}
          onChange={(e) => setChoicesInput(e.target.value)}
          className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 text-[12px] text-gray-700 placeholder:text-gray-400 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
        />
      )}
      {error && <p className="text-[11px] text-red-500">{error}</p>}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={submit}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cyan-500 text-white text-[12px] font-medium hover:bg-cyan-600 disabled:opacity-50 transition-colors"
        >
          {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
          Save Field
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-md text-[12px] text-gray-500 hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
