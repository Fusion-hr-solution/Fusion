using EY.HRPlatform.Performance.Domain.Entities;

namespace EY.HRPlatform.Performance.Features.Notifications.Dtos;

public sealed record PerformanceNotificationDto(
    Guid Id,
    string Type,
    string Title,
    string Message,
    Guid? CycleId,
    string? SubjectType,
    Guid? SubjectId,
    string? NavigationRoute,
    DateTime CreatedAt,
    DateTime? ReadAt,
    bool IsRead);

public static class PerformanceNotificationMapper
{
    public static PerformanceNotificationDto ToDto(PerformanceNotification notification)
        => new(
            notification.Id,
            notification.Type.ToString(),
            notification.Title,
            notification.Message,
            notification.CycleId,
            notification.SubjectType,
            notification.SubjectId,
            notification.NavigationRoute,
            notification.CreatedAt,
            notification.ReadAt,
            notification.IsRead);
}
