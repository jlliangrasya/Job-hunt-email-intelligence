"use client";
import { useState } from "react";
import { StepConnectGmail } from "./StepConnectGmail";
import { StepScanProgress } from "./StepScanProgress";
import { StepDone } from "./StepDone";

const STEP_LABELS = ["Connect Gmail", "Scan Mail", "Done"];

export function OnboardingWizard({ hasGmail }) {
  const [step, setStep] = useState(hasGmail ? 1 : 0);
  const [detected, setDetected] = useState(0);

  function handleScanComplete(count) {
    setDetected(count);
    setStep(2);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-center gap-2">
        {STEP_LABELS.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={`size-7 rounded-full flex items-center justify-center text-xs font-bold ${
                i <= step
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </div>
            <span className={`text-sm ${i === step ? "font-medium" : "text-muted-foreground"}`}>
              {label}
            </span>
            {i < STEP_LABELS.length - 1 && (
              <div className={`h-px w-8 ${i < step ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-8">
        {step === 0 && <StepConnectGmail onNext={() => setStep(1)} />}
        {step === 1 && <StepScanProgress onNext={handleScanComplete} />}
        {step === 2 && <StepDone detected={detected} />}
      </div>
    </div>
  );
}
