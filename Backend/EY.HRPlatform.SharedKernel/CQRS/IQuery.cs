using System;
using System.Collections.Generic;
using System.Text;

using MediatR;

namespace EY.HRPlatform.SharedKernel.CQRS;

public interface IQuery<out TResponse> : IRequest<TResponse>
{
}