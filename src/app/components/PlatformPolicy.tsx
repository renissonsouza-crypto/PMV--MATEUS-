import { PLATFORM_POLICIES } from "../../../shared/policies.mjs";
import type { ReactNode } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "./ui/dialog";

type PolicyKind = "terms" | "privacy" | "data";


export function PlatformPolicyLink({ kind, children, className }: { kind: PolicyKind; children: ReactNode; className?: string }) {
  const policy = PLATFORM_POLICIES[kind];
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className={className}>{children}</button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl bg-white text-slate-900">
        <DialogHeader>
          <DialogTitle className="pr-10 text-xl">{policy.title}</DialogTitle>
          <DialogDescription>{policy.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm leading-relaxed text-slate-700">{policy.paragraphs.map((paragraph: string, index: number) => <p key={index}>{paragraph.split(/(https:\/\/[^\s]+)/).map((part, n) => part.startsWith("https://") ? <a key={n} href={part} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 underline">Texto oficial da LGPD</a> : part)}</p>)}</div>
      </DialogContent>
    </Dialog>
  );
}
