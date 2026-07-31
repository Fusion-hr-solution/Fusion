using EY.HRPlatform.CoreHR.Domain.Entities;

namespace EY.HRPlatform.CoreHR.Features.Employees.Services;

public interface IEmployeeReadScopeService
{
    IQueryable<Employee> ApplyListScope(
        IQueryable<Employee> query,
        EmployeeReadAudience audience,
        Guid? requesterEmployeeId);

    bool CanAccessEmployee(
        Employee employee,
        EmployeeReadAudience audience,
        Guid? requesterEmployeeId);
}

public sealed class EmployeeReadScopeService : IEmployeeReadScopeService
{
    public IQueryable<Employee> ApplyListScope(
        IQueryable<Employee> query,
        EmployeeReadAudience audience,
        Guid? requesterEmployeeId)
    {
        return audience switch
        {
            EmployeeReadAudience.HrAdmin => query,
            EmployeeReadAudience.Employee when requesterEmployeeId.HasValue =>
                query.Where(employee => employee.Id == requesterEmployeeId.Value),
            EmployeeReadAudience.Manager => query.Where(_ => false),
            _ => query.Where(_ => false),
        };
    }

    public bool CanAccessEmployee(
        Employee employee,
        EmployeeReadAudience audience,
        Guid? requesterEmployeeId)
    {
        return audience switch
        {
            EmployeeReadAudience.HrAdmin => true,
            EmployeeReadAudience.Employee => requesterEmployeeId.HasValue && employee.Id == requesterEmployeeId.Value,
            EmployeeReadAudience.Manager => false,
            _ => false,
        };
    }
}
