using System;
using System.Collections.Generic;
using System.Text;
using MediatR;

namespace EY.HRPlatform.SharedKernel.CQRS;

public interface IQueryHandler<in TQuery, TResponse> : IRequestHandler<TQuery, TResponse>
    where TQuery : IQuery<TResponse>
{
}