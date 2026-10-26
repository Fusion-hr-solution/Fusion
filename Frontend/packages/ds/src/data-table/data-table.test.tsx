import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithIntl } from "../testing/intl";
import fr from "../messages/fr.json";
import { DataTable } from "./data-table";
import { createDataTableColumnHelper } from "./features";
import { useDataTable, type DataTableFilterField } from "./use-data-table";

interface Person {
  id: string;
  name: string;
  team: string;
}

const PEOPLE: Person[] = Array.from({ length: 12 }, (_, index) => ({
  id: `p${index}`,
  name: `Person ${index + 1}`,
  team: index % 2 ? "Design" : "Sales",
}));

const column = createDataTableColumnHelper<Person>();
const COLUMNS = [column.accessor("name", { id: "name", header: "Name" })];
const FILTERS: DataTableFilterField<Person>[] = [
  {
    id: "team",
    label: "Team",
    type: "options",
    pinned: true,
    options: [
      { value: "Sales", label: "Sales" },
      { value: "Design", label: "Design" },
    ],
    value: (row) => row.team,
  },
];

function People() {
  const model = useDataTable({
    data: PEOPLE,
    columns: COLUMNS,
    getRowId: (row) => row.id,
    search: (row) => row.name,
    filters: FILTERS,
    pageSize: 10,
  });
  return <DataTable model={model} />;
}

describe("DataTable chrome", () => {
  it("reads in English by default", () => {
    renderWithIntl(<People />);
    expect(screen.getByRole("searchbox", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByText(/of 12 rows/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeInTheDocument();
  });

  it("speaks French around the caller's own words", () => {
    renderWithIntl(<People />, { locale: "fr", messages: fr });
    expect(screen.getByRole("searchbox", { name: "Rechercher" })).toBeInTheDocument();
    expect(screen.getByText(/sur 12 lignes/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page suivante" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Team est Tous. Modifier" })).toBeInTheDocument();
  });
});
