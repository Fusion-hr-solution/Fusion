using System.Globalization;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Features.Reviews;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace EY.HRPlatform.Performance.Infrastructure.Pdf;

/// <summary>
/// Lays out a released review (board 15) from the reader's projection of the finalized record, so the file always matches
/// what that reader may see: the person's copy carries no potential and no peer answers; no copy carries calibration detail.
/// Rendering is deterministic for a review and copy: the document dates are the release time, not the download time.
/// </summary>
public static class ReviewPdfRenderer
{
    private static readonly CultureInfo En = CultureInfo.GetCultureInfo("en-GB");

    public static byte[] Render(PerformanceReviewDto review)
    {
        if (review.State != PerformanceReviewState.Finalized || review.FinalizedAt is not DateTime released)
            throw new InvalidOperationException("Only a released review has a PDF.");
        QuestPDF.Settings.License = LicenseType.Community;
        var scale = review.RatingScale.ToDictionary(level => level.Value, level => level.Label);
        string Rating(int? value) => value is int v ? $"{v} · {scale.GetValueOrDefault(v, v.ToString(En))}" : "Not rated";
        var objectives = review.Items.Where(item => item.Kind == ReviewItemKind.Objective).ToList();
        var competencies = review.Items.Where(item => item.Kind == ReviewItemKind.Competency).ToList();

        return Document.Create(container => container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(40);
                page.DefaultTextStyle(text => text.FontSize(10).FontColor(Colors.Grey.Darken4));

                page.Header().PaddingBottom(14).Row(row =>
                {
                    row.RelativeItem().Text("Fusion Performance · Confidential").FontSize(8).FontColor(Colors.Grey.Darken1);
                    row.AutoItem().Text(text =>
                    {
                        text.DefaultTextStyle(style => style.FontSize(8).FontColor(Colors.Grey.Darken1));
                        text.Span("Page ");
                        text.CurrentPageNumber();
                        text.Span(" of ");
                        text.TotalPages();
                    });
                });

                page.Content().Column(column =>
                {
                    column.Spacing(14);
                    column.Item().Column(head =>
                    {
                        head.Item().Text($"{review.ReviewRoundName} · {review.PeriodStart.ToString("d MMM yyyy", En)} – {review.PeriodEnd.ToString("d MMM yyyy", En)}")
                            .FontSize(9).FontColor(Colors.Grey.Darken1);
                        head.Item().PaddingTop(4).Text(review.SubjectDisplayName).FontSize(20).SemiBold();
                        var role = string.Join(" · ", new[] { review.SubjectJobTitle, review.SubjectOrgUnitName }.Where(v => !string.IsNullOrWhiteSpace(v)));
                        head.Item().Text($"{(role.Length > 0 ? role + " · " : "")}reviewed by {review.ReviewerDisplayName} · released {released.ToString("d MMM yyyy", En)}")
                            .FontColor(Colors.Grey.Darken2);
                    });

                    column.Item().Background(Colors.Grey.Lighten4).Padding(14).Row(row =>
                    {
                        row.RelativeItem().Column(final =>
                        {
                            final.Item().Text("Final rating").FontSize(9).FontColor(Colors.Grey.Darken1);
                            final.Item().Text(review.FinalRating is int rating ? scale.GetValueOrDefault(rating, rating.ToString(En)) : "Not rated").FontSize(16).SemiBold();
                            if (review.FinalRating is int value) final.Item().Text($"{value} of {review.RatingScale.Count}").FontColor(Colors.Grey.Darken1);
                        });
                        if (review.Potential is ReviewPotential potential)
                            row.AutoItem().Column(cell =>
                            {
                                cell.Item().Text("Potential · reviewer and HR only").FontSize(9).FontColor(Colors.Grey.Darken1);
                                cell.Item().Text(potential.ToString()).FontSize(14).SemiBold();
                            });
                    });

                    if (review.ManagerAssessment is { } manager)
                        Section(column, "Manager's summary", body => body.Item().Text(manager.Summary));

                    if (objectives.Count > 0)
                        Section(column, "Objectives", body =>
                        {
                            for (var index = 0; index < objectives.Count; index++)
                            {
                                var item = objectives[index];
                                body.Item().PaddingBottom(6).Column(entry =>
                                {
                                    entry.Item().Row(row =>
                                    {
                                        row.RelativeItem().Text($"{index + 1:00}  {item.Title}").SemiBold();
                                        row.AutoItem().Text(Rating(item.ManagerRating));
                                    });
                                    var facts = string.Join(" · ", new[]
                                    {
                                        item.Progress is decimal progress ? $"{decimal.Round(progress, 0)}%" : null,
                                        item.Status?.ToString(),
                                    }.Where(v => v is not null));
                                    if (facts.Length > 0) entry.Item().Text(facts).FontSize(9).FontColor(Colors.Grey.Darken1);
                                    if (!string.IsNullOrWhiteSpace(item.ManagerAssessment)) entry.Item().Text(item.ManagerAssessment);
                                    if (!string.IsNullOrWhiteSpace(item.SelfReflection))
                                        entry.Item().Text($"{review.SubjectDisplayName}: {item.SelfReflection}").FontSize(9).FontColor(Colors.Grey.Darken2);
                                });
                            }
                        });

                    if (competencies.Count > 0)
                        Section(column, "Competencies", body =>
                        {
                            foreach (var item in competencies)
                                body.Item().PaddingBottom(6).Column(entry =>
                                {
                                    entry.Item().Row(row =>
                                    {
                                        row.RelativeItem().Text(item.Title).SemiBold();
                                        row.AutoItem().Text(Rating(item.ManagerRating));
                                    });
                                    if (!string.IsNullOrWhiteSpace(item.ManagerAssessment)) entry.Item().Text(item.ManagerAssessment);
                                    if (!string.IsNullOrWhiteSpace(item.SelfComment))
                                        entry.Item().Text($"{review.SubjectDisplayName}: {item.SelfComment}").FontSize(9).FontColor(Colors.Grey.Darken2);
                                });
                        });

                    var answered = review.Questions.Where(q => q.SelfAnswer is not null || q.ManagerAnswer is not null)
                        .OrderBy(q => q.Audience == ReviewQuestionAudience.Manager ? 0 : 1).ThenBy(q => q.SortOrder).ToList();
                    if (answered.Count > 0)
                        Section(column, "Questions", body =>
                        {
                            foreach (var question in answered)
                                body.Item().PaddingBottom(6).Column(entry =>
                                {
                                    var author = question.Audience == ReviewQuestionAudience.Manager ? review.ReviewerDisplayName : review.SubjectDisplayName;
                                    entry.Item().Text($"{question.Text} · {author}").SemiBold();
                                    entry.Item().Text(question.Audience == ReviewQuestionAudience.Manager ? question.ManagerAnswer : question.SelfAnswer);
                                });
                        });

                    var peerAnswers = review.Peers?.People.Where(p => p.Answers is { Count: > 0 }).ToList() ?? [];
                    if (peerAnswers.Count > 0)
                        Section(column, "Peer input · reviewer and HR only", body =>
                        {
                            foreach (var peer in peerAnswers)
                                body.Item().PaddingBottom(6).Column(entry =>
                                {
                                    entry.Item().Text(peer.DisplayName).SemiBold();
                                    foreach (var answer in peer.Answers!)
                                        entry.Item().Text($"{answer.Question} {answer.Text}");
                                });
                        });

                    if (review.SelfAssessment is { } self && !string.IsNullOrWhiteSpace(self.Summary))
                        Section(column, $"{review.SubjectDisplayName}'s summary", body => body.Item().Text(self.Summary));

                    Section(column, "Acknowledgement", body => body.Item().Text(review.Acknowledgement is { } acknowledgement
                        ? $"Acknowledged by {review.SubjectDisplayName} on {acknowledgement.At.ToString("d MMM yyyy", En)}"
                            + (acknowledgement.Comment is null ? "" : $" · “{acknowledgement.Comment}”")
                        : "Not acknowledged yet"));
                });

                page.Footer().Text($"Generated from the released record of {released.ToString("d MMM yyyy HH:mm", En)} UTC · Fusion Performance")
                    .FontSize(8).FontColor(Colors.Grey.Darken1);
            }))
            .WithMetadata(new DocumentMetadata
            {
                Title = $"{review.ReviewRoundName} · {review.SubjectDisplayName}",
                Author = "Fusion Performance",
                CreationDate = released,
                ModifiedDate = released,
            })
            .GeneratePdf();
    }

    private static void Section(ColumnDescriptor column, string title, Action<ColumnDescriptor> content)
        => column.Item().Column(section =>
        {
            section.Item().PaddingBottom(6).BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Text(title).FontSize(12).SemiBold();
            content(section);
        });
}
