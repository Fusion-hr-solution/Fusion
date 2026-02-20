using System;
using System.Collections.Generic;
using System.Text;

using MediatR;

namespace EY.HRPlatform.SharedKernel.CQRS;

public interface ICommandHandler<in TCommand> : IRequestHandler<TCommand, Unit>
    where TCommand : ICommand
{
}

public interface ICommandHandler<in TCommand, TResponse> : IRequestHandler<TCommand, TResponse>
    where TCommand : ICommand<TResponse>
{
}