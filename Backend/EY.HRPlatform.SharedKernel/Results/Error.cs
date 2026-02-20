using System;
using System.Collections.Generic;
using System.Text;

namespace EY.HRPlatform.SharedKernel.Results;

public sealed record Error(string Code, string Message)
{
    public static readonly Error None = new(string.Empty, string.Empty);
    public static readonly Error NullValue = new("Error.NullValue", "A null value was provided.");

    public static Error NotFound(string entity, Guid id) =>
        new($"{entity}.NotFound", $"{entity} with Id '{id}' was not found.");

    public static Error Validation(string code, string message) =>
        new(code, message);

    public static Error Conflict(string code, string message) =>
        new(code, message);
}
