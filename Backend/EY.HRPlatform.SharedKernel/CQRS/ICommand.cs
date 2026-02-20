using System;
using System.Collections.Generic;
using System.Text;

using MediatR;

namespace EY.HRPlatform.SharedKernel.CQRS;

/// <summary>
/// Command with no return value.
/// </summary>
public interface ICommand : IRequest<Unit>
{
}

/// <summary>
/// Command that returns a result of type TResponse.
/// </summary>
public interface ICommand<out TResponse> : IRequest<TResponse>
{
}