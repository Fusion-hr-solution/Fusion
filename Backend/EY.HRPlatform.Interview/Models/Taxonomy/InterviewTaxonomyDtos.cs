namespace EY.HRPlatform.Interview.Models.Taxonomy;

/// <summary>The merged taxonomy: canonical defaults with the admin's overrides applied.</summary>
public class InterviewTaxonomyDto
{
    public int Version { get; set; }
    public Dictionary<string, TaxonomyListDto> Lists { get; set; } = [];
}

public class TaxonomyListDto
{
    public string Key { get; set; } = string.Empty;

    /// <summary>True when values are pinned to a C# enum: relabel, reorder and hide only.</summary>
    public bool Locked { get; set; }

    public List<TaxonomyItemDto> Items { get; set; } = [];
}

public class TaxonomyItemDto
{
    /// <summary>The wire value. Never changes for a locked list.</summary>
    public string Value { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;

    /// <summary>Hidden from new-question dropdowns. Existing records keep working — this is
    /// curation, not authorization; the API still accepts the value.</summary>
    public bool Hidden { get; set; }

    /// <summary>True when the item still matches its canonical default (value present in the
    /// catalogue and label untouched). Lets the UI mark customised rows.</summary>
    public bool IsDefault { get; set; }

    /// <summary>Coding languages only: false when the grader has no mapping and would silently
    /// execute submissions as Python 3. Null for every other list.</summary>
    public bool? SupportsAutoGrading { get; set; }
}

/// <summary>Partial update — only the lists being saved need to be present.</summary>
public class UpdateInterviewTaxonomyDto
{
    public Dictionary<string, List<UpdateTaxonomyItemDto>> Lists { get; set; } = [];
}

public class UpdateTaxonomyItemDto
{
    public string Value { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public bool Hidden { get; set; }
}
