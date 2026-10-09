"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createAgentSchema, type CreateAgentFormData } from "@/lib/validators";
import { VOICE_MODEL_OPTIONS, DEFAULTS } from "@/lib/constants";
import { VoiceField, LanguageField } from "@/components/agents/voice-language-fields";
import type { RetellAgent } from "@/types/retell";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface AgentFormProps {
  defaultValues?: RetellAgent;
  onSubmit: (data: CreateAgentFormData) => Promise<void>;
  isSubmitting: boolean;
  mode: "create" | "edit";
}

export function AgentForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  mode,
}: AgentFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateAgentFormData>({
    resolver: zodResolver(createAgentSchema),
    defaultValues: defaultValues
      ? {
          agent_name: defaultValues.agent_name || "",
          response_engine: defaultValues.response_engine,
          voice_id: defaultValues.voice_id,
          voice_model: defaultValues.voice_model || undefined,
          voice_speed: defaultValues.voice_speed ?? DEFAULTS.voiceSpeed,
          voice_temperature:
            defaultValues.voice_temperature ?? DEFAULTS.voiceTemperature,
          volume: defaultValues.volume ?? DEFAULTS.volume,
          language: defaultValues.language || undefined,
          webhook_url: defaultValues.webhook_url || "",
        }
      : {
          agent_name: "",
          response_engine: { type: "retell-llm" },
          voice_id: "retell-Cimo",
          voice_speed: DEFAULTS.voiceSpeed,
          voice_temperature: DEFAULTS.voiceTemperature,
          volume: DEFAULTS.volume,
        },
  });

  const voiceSpeed = watch("voice_speed");
  const voiceTemp = watch("voice_temperature");
  const volume = watch("volume");

  const inputClass =
    "w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all";
  const inputErrorClass =
    "w-full px-3.5 py-2.5 rounded-lg border border-red-300 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <FormSection title="Basic Information">
        <FormField label="Agent Name" error={errors.agent_name?.message} required>
          <input
            {...register("agent_name")}
            placeholder="e.g. Customer Support Agent"
            className={errors.agent_name ? inputErrorClass : inputClass}
          />
        </FormField>

        <FormField label="Voice" error={errors.voice_id?.message} required>
          <VoiceField value={watch("voice_id")} onSave={(v) => setValue("voice_id", v, { shouldDirty: true })} />
        </FormField>

        <FormField label="Language">
          <LanguageField value={watch("language")} onSave={(v) => setValue("language", v, { shouldDirty: true })} />
        </FormField>
      </FormSection>

      <FormSection title="Voice Configuration">
        <FormField label="Voice Model">
          <select {...register("voice_model")} className={inputClass}>
            <option value="">Default</option>
            {VOICE_MODEL_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </FormField>

        <SliderField
          label="Voice Speed"
          value={voiceSpeed ?? DEFAULTS.voiceSpeed}
          min={0.5}
          max={2.0}
          step={0.1}
          onChange={(v) => setValue("voice_speed", v)}
        />

        <SliderField
          label="Voice Temperature"
          value={voiceTemp ?? DEFAULTS.voiceTemperature}
          min={0}
          max={2.0}
          step={0.1}
          onChange={(v) => setValue("voice_temperature", v)}
        />

        <SliderField
          label="Volume"
          value={volume ?? DEFAULTS.volume}
          min={0}
          max={2.0}
          step={0.1}
          onChange={(v) => setValue("volume", v)}
        />
      </FormSection>

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-500 text-white text-[13px] font-medium hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm shadow-brand-500/20"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {mode === "create" ? "Create Agent" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-[13px] font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function FormField({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[13px] font-medium text-gray-700">{label}</label>
        <span className="text-[13px] font-mono text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
          {value.toFixed(1)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          background: `linear-gradient(to right, var(--color-brand-500) 0%, var(--color-brand-500) ${
            max === min ? 0 : ((value - min) / (max - min)) * 100
          }%, var(--color-gray-200) ${
            max === min ? 0 : ((value - min) / (max - min)) * 100
          }%, var(--color-gray-200) 100%)`,
        }}
        className="range-fill w-full h-2 rounded-full cursor-pointer"
      />
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-gray-400">{min}</span>
        <span className="text-[10px] text-gray-400">{max}</span>
      </div>
    </div>
  );
}
