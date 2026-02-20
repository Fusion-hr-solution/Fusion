using System;
using System.Collections.Generic;
using System.Text;

namespace EY.HRPlatform.SharedKernel.Domain;

public abstract record DomainEventBase : IDomainEvent
{
    public Guid EventId { get; } = Guid.NewGuid();
    public DateTime OccurredOn { get; } = DateTime.UtcNow;
}