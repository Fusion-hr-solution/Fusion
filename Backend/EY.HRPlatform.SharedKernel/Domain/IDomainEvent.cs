using System;
using System.Collections.Generic;
using System.Text;

using MediatR;

namespace EY.HRPlatform.SharedKernel.Domain;

public interface IDomainEvent : INotification
{
    Guid EventId { get; }
    DateTime OccurredOn { get; }
}
