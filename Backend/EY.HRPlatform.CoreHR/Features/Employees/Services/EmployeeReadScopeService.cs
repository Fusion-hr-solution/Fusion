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
            EmployeeReadAudience.Manager when requesterEmployeeId.HasValue =>
                query.Where(employee => employee.ManagerId == requesterEmployeeId.Value),
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
            EmployeeReadAudience.Manager => requesterEmployeeId.HasValue && employee.ManagerId == requesterEmployeeId.Value,
            _ => false,
        };
    }
}