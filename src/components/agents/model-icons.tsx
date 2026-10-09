import { Aperture, Asterisk, Sparkles, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

type IconProps = { className?: string };
export type ModelProvider = "openai" | "anthropic" | "google" | "other";

export function modelProvider(model: string): ModelProvider {
  const m = model.toLowerCase();
  if (m.startsWith("gpt") || /^o[134]/.test(m)) return "openai";
  if (m.startsWith("claude")) return "anthropic";
  if (m.startsWith("gemini")) return "google";
  return "other";
}

function OpenAIIcon({ className }: IconProps) {
  return <Aperture className={cn("text-emerald-600", className)} />;
}
function AnthropicIcon({ className }: IconProps) {
  return <Asterisk className={cn("text-orange-500", className)} />;
}
function GoogleIcon({ className }: IconProps) {
  return <Sparkles className={cn("text-blue-500", className)} />;
}
function OtherIcon({ className }: IconProps) {
  return <Cpu className={cn("text-gray-500", className)} />;
}

export function modelIcon(model: string): React.ComponentType<IconProps> {
  switch (modelProvider(model)) {
    case "openai":
      return OpenAIIcon;
    case "anthropic":
      return AnthropicIcon;
    case "google":
      return GoogleIcon;
    default:
      return OtherIcon;
  }
}
