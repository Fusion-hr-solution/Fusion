namespace EY.HRPlatform.Training.Models.Requests;

public class ReorderPartsRequest
{
    public List<Guid> PartIds { get; set; } = [];
}
