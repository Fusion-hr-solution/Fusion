using System.Text;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Tokens;
using EY.HRPlatform.SharedKernel.Security;

var builder = WebApplication.CreateBuilder(args);

// Performance has no business endpoints yet. It still establishes its security
// boundary now so that the first endpoint added here is protected by default
// rather than accidentally public: anything that is not explicitly anonymous
// requires an authenticated caller whose session carries a membership-derived
// customer tenant and the Performance entitlement for that tenant.
var jwtSecret = builder.Configuration["Jwt:Secret"]
    ?? throw new InvalidOperationException("Jwt:Secret is not configured.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtSecret)),
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddModuleEntitlementAuthorization();
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .AddRequirements(new ModuleEntitlementRequirement(ModuleEntitlements.Performance))
        .Build();
});

builder.Services.AddHealthChecks();

// Customer traffic reaches this service only through the Gateway, which is where
// withdrawn tenant access is enforced per request. Refuse to start somewhere it
// could be reached around that.
GatewayOnlyBindingGuard.Verify(
    "Performance",
    builder.Configuration["Urls"] ?? builder.Configuration["ASPNETCORE_URLS"],
    builder.Configuration);

var app = builder.Build();

// Before routing and model binding: signatures on internal routes are
// body-bound, and a request stream can only be read once.
app.UseInternalServiceBodyBuffering();

app.UseAuthentication();
app.UseAuthorization();

// Liveness and readiness are infrastructure probes, not customer data, so they
// stay anonymous and are the only endpoints exempt from the boundary above.
app.MapHealthChecks("/health/live").AllowAnonymous();
app.MapHealthChecks("/health/ready").AllowAnonymous();

app.Run();

/// <summary>Exposed so integration tests can host this boundary.</summary>
public partial class Program;
