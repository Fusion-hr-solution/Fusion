using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Training.Models.Requests;

public sealed record RevokeCertificateRequest([Required, MinLength(3)] string Reason);
