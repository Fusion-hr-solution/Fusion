import { ClipboardList, Hash, Users, Tag } from "lucide-react";
import type { WizardFormData, SelectedQuestion } from "@/types";

interface Step4Props {
  formData: WizardFormData;
  selectedQuestions: SelectedQuestion[];
}

export function Step4Review({ formData, selectedQuestions }: Step4Props) {
  const totalPoints = selectedQuestions.reduce((s, q) => s + q.points, 0);
  const totalDuration = selectedQuestions.reduce((s, q) => s + q.duration, 0);

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div className="mb-2">
        <h2 className="text-xl font-bold text-zinc-900">Review & Publish</h2>
        <p className="text-sm text-zinc-500 mt-1">Review your test before publishing.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: ClipboardList, label: "Questions", value: selectedQuestions.length },
          { icon: Hash, label: "Total Points", value: totalPoints },
          { icon: Users, label: "Est. Duration", value: `${totalDuration} min` },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-center">
            <Icon className="w-5 h-5 text-zinc-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-zinc-900">{value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Basic info */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-zinc-900">Basic Information</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-zinc-400 mb-0.5">Title</p>
            <p className="font-medium text-zinc-800">{formData.title || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400 mb-0.5">Discipline</p>
            <p className="font-medium text-zinc-800">{formData.discipline || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400 mb-0.5">Role</p>
            <p className="font-medium text-zinc-800">{formData.role || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400 mb-0.5">Status after publish</p>
            <span className="text-xs font-semibold px-2 py-0.5 bg-zinc-900 text-white rounded-md">Active</span>
          </div>
        </div>
        {formData.description && (
          <div>
            <p className="text-xs text-zinc-400 mb-0.5">Description</p>
            <p className="text-sm text-zinc-700">{formData.description}</p>
          </div>
        )}
      </div>

      {/* Questions list */}
      {selectedQuestions.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-zinc-900 mb-3">Questions ({selectedQuestions.length})</h3>
          <div className="space-y-2">
            {selectedQuestions.sort((a, b) => a.order - b.order).map((q, i) => (
              <div key={q.id} className="flex items-center gap-3 p-2.5 bg-zinc-50 rounded-lg">
                <span className="w-5 h-5 bg-zinc-200 text-zinc-600 text-xs font-semibold rounded-full flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <span className="flex-1 text-sm text-zinc-800 font-medium truncate">{q.title}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs px-2 py-0.5 border border-zinc-200 rounded text-zinc-600">{q.type}</span>
                  <span className="text-xs font-semibold text-zinc-700">{q.points}pt</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center mt-3 pt-3 border-t border-zinc-100">
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Tag className="w-3.5 h-3.5" />
              Total points
            </div>
            <span className="text-sm font-bold text-zinc-900">{totalPoints} pts</span>
          </div>
        </div>
      )}
    </div>
  );
}