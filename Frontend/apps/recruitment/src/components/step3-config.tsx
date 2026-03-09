import { Settings2 } from "lucide-react";

export function Step3Config() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-24 text-center">
      <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mb-4">
        <Settings2 className="w-7 h-7 text-zinc-400" />
      </div>
      <h3 className="text-base font-semibold text-zinc-900 mb-2">Configuration</h3>
      <p className="text-sm text-zinc-500 max-w-xs">
        Test timing, access controls, randomisation and scoring rules will be configurable here.
      </p>
      <span className="mt-4 text-xs font-medium px-3 py-1.5 bg-zinc-100 text-zinc-500 rounded-full">
        Coming soon
      </span>
    </div>
  );
}