import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HomeAgenda, LeadFocus, agendaEntries, selectLead, type HomeMoment, type HomeWorkItem } from "./home";

const today = new Date(2026, 9, 20); // Tuesday 20 October 2026

const selfAssessment: HomeWorkItem = {
  id: "performance:self-assessment:1",
  module: "performance",
  kind: "self-assessment",
  title: "Complete your self-assessment",
  context: "Year-end review",
  dueOn: "2026-10-23",
  href: "/performance/reviews/1",
  steps: [
    { label: "You", detail: "Due Fri 23 Oct", state: "current" },
    { label: "Mariam", detail: "Due Fri 30 Oct", state: "upcoming" },
    { label: "Calibration", detail: "HR", state: "upcoming" },
    { label: "Your result", detail: "Released by HR", state: "upcoming" },
  ],
};
const updateRequest: HomeWorkItem = {
  id: "performance:update-request:2",
  module: "performance",
  kind: "update-request",
  title: "Update progress on Ship the playbook",
  href: "/performance/cycles/c/objectives/o?mode=record",
};
const lateReviews: HomeWorkItem = {
  id: "performance:manager-assessment:3",
  module: "performance",
  kind: "manager-assessment",
  title: "Assess Omar",
  dueOn: "2026-10-19",
  href: "/performance/reviews/3",
};
const aichaPlan: HomeWorkItem = {
  id: "performance:plan-decision:4",
  module: "performance",
  kind: "plan-decision",
  title: "Review Aicha's plan",
  href: "/performance/cycles/c/plans/4",
  subject: { displayName: "Aicha" },
  waitingSince: "2026-10-17T09:00:00Z",
};
const peerInput: HomeWorkItem = {
  id: "performance:peer-input:5",
  module: "performance",
  kind: "peer-input",
  title: "Peer input for Omar",
  dueOn: "2026-10-30",
  href: "/performance/reviews/peer-requests/5",
  waitingSince: "2026-10-19T09:00:00Z",
};
const access: HomeWorkItem = { id: "core:access", module: "core", title: "12 people don't have Fusion access yet", href: "/core/workforce-access" };
const oneOnOne: HomeMoment = {
  id: "performance:one-on-one:m1",
  module: "performance",
  kind: "one-on-one",
  title: "1:1 with Mariam Gharbi",
  context: "2 on the agenda",
  date: "2026-10-22",
  at: "2026-10-22T09:00:00Z",
  href: "/performance/one-on-ones/s1",
};
const selfDue: HomeMoment = {
  id: "performance:self-assessment-due:1",
  module: "performance",
  kind: "self-assessment-due",
  title: "Your self-assessment due",
  date: "2026-10-23",
  href: "/performance/reviews/1",
  covers: ["self-assessment", "nominate-peers"],
};

const label = (key: string) => (key === "core" ? "Core HR" : "Performance");

describe("selectLead", () => {
  it("leads with an overdue item, then the earliest due, then the first undated", () => {
    expect(selectLead([updateRequest, selfAssessment, lateReviews], [oneOnOne], today)).toEqual({ kind: "work", item: lateReviews });
    expect(selectLead([updateRequest, selfAssessment], [oneOnOne], today)).toEqual({ kind: "work", item: selfAssessment });
    expect(selectLead([access, updateRequest], [oneOnOne], today)).toEqual({ kind: "work", item: access });
  });

  it("puts work someone is waiting on ahead of the person's own work that isn't late, longest wait first", () => {
    expect(selectLead([selfAssessment, peerInput, aichaPlan], [oneOnOne], today)).toEqual({ kind: "work", item: aichaPlan });
    expect(selectLead([selfAssessment, peerInput], [], today)).toEqual({ kind: "work", item: peerInput });
    expect(selectLead([access, aichaPlan], [], today)).toEqual({ kind: "work", item: aichaPlan });
  });

  it("still leads with the person's own late work over work someone is waiting on", () => {
    expect(selectLead([aichaPlan, lateReviews, peerInput], [], today)).toEqual({ kind: "work", item: lateReviews });
    const latePeerInput = { ...peerInput, dueOn: "2026-10-18" };
    expect(selectLead([aichaPlan, latePeerInput], [], today)).toEqual({ kind: "work", item: latePeerInput });
  });

  it("leads with the next moment when there is no work, and nothing when there is nothing", () => {
    expect(selectLead([], [selfDue, oneOnOne], today)).toEqual({ kind: "moment", moment: oneOnOne });
    expect(selectLead([], [], today)).toBeNull();
  });
});

describe("LeadFocus", () => {
  it("shows the module, title, steps, time left and one action", () => {
    render(<LeadFocus lead={{ kind: "work", item: selfAssessment }} moduleLabel={label} today={today} />);
    expect(screen.getByText("Performance")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Complete your self-assessment" })).toBeInTheDocument();
    expect(screen.getByText("days left")).toBeInTheDocument();
    expect(screen.getAllByText("Due Fri 23 Oct")).toHaveLength(2);
    expect(screen.getByRole("list", { name: "Where this stands" }).children).toHaveLength(4);
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("href", "/performance/reviews/1");
  });

  it("reads work someone is waiting on as how long they've waited", () => {
    render(<LeadFocus lead={{ kind: "work", item: aichaPlan }} moduleLabel={label} today={today} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("days waiting")).toBeInTheDocument();
    expect(screen.getByText("Waiting since Sat 17 Oct")).toBeInTheDocument();
    expect(screen.queryByText(/days left/)).not.toBeInTheDocument();
  });

  it("keeps a waiting item's due date and says when the wait started today", () => {
    render(<LeadFocus lead={{ kind: "work", item: { ...peerInput, waitingSince: "2026-10-20T08:00:00" } }} moduleLabel={label} today={today} />);
    expect(screen.getByText("waiting since today")).toBeInTheDocument();
    expect(screen.getByText("Due Fri 30 Oct")).toBeInTheDocument();
  });

  it("reads an overdue item as late", () => {
    render(<LeadFocus lead={{ kind: "work", item: lateReviews }} moduleLabel={label} today={today} />);
    expect(screen.getByText("day late")).toBeInTheDocument();
  });

  it("features the next moment when nothing needs the person", () => {
    render(<LeadFocus lead={{ kind: "moment", moment: oneOnOne }} moduleLabel={label} today={today} />);
    expect(screen.getByText(/Nothing needs you today/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "1:1 with Mariam Gharbi" })).toBeInTheDocument();
    expect(screen.getByText(/In 2 days · 2 on the agenda/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the 1:1" })).toHaveAttribute("href", "/performance/one-on-ones/s1");
  });

  it("names the lead's action when the module says what it does", () => {
    render(<LeadFocus lead={{ kind: "work", item: { ...lateReviews, actionLabel: "Write the review" } }} moduleLabel={label} today={today} />);
    expect(screen.getByRole("link", { name: "Write the review" })).toHaveAttribute("href", lateReviews.href);
  });

  it("states that nothing needs the person and nothing is scheduled", () => {
    render(<LeadFocus lead={null} moduleLabel={label} today={today} />);
    expect(screen.getByRole("heading", { name: "No work and nothing scheduled in the next two weeks" })).toBeInTheDocument();
  });
});

describe("Next two weeks", () => {
  it("lists dated work and moments by day without the lead or work a moment covers", () => {
    const entries = agendaEntries({
      work: [selfAssessment, { ...lateReviews, id: "x", dueOn: "2026-10-28", title: "Feedback for Rim" }],
      moments: [oneOnOne, selfDue],
      lead: { kind: "work", item: { ...updateRequest } },
      today,
    });
    expect(entries.map((e) => e.title)).toEqual(["1:1 with Mariam Gharbi", "Your self-assessment due", "Feedback for Rim due"]);
  });

  it("doesn't repeat a featured moment and leaves out what is past or beyond two weeks", () => {
    const entries = agendaEntries({
      work: [{ ...updateRequest, dueOn: "2026-11-30", id: "far" }, { ...updateRequest, dueOn: "2026-10-10", id: "past" }],
      moments: [oneOnOne],
      lead: { kind: "moment", moment: oneOnOne },
      today,
    });
    expect(entries).toEqual([]);
  });

  it("says nothing is scheduled and names a module that couldn't answer", () => {
    render(
      <HomeAgenda work={[]} moments={[]} lead={null} today={today}
        modules={[{ key: "performance", label: "Performance", status: "error" }]} />,
    );
    expect(screen.getByText("Nothing is scheduled in the next two weeks")).toBeInTheDocument();
    expect(screen.getByText("Performance's dates couldn't be loaded")).toBeInTheDocument();
  });
});
