using System;
using System.Collections.Generic;
using System.Text;

namespace EY.HRPlatform.SharedKernel.Domain.ValueObjects;

public record EmployeeId
{
    public Guid Value { get; }

    public EmployeeId(Guid value)
    {
        if (value == Guid.Empty)
            throw new ArgumentException("EmployeeId cannot be empty.", nameof(value));
        Value = value;
    }

    public static EmployeeId New() => new(Guid.NewGuid());
    public static implicit operator Guid(EmployeeId id) => id.Value;
    public static explicit operator EmployeeId(Guid id) => new(id);
    public override string ToString() => Value.ToString();
}