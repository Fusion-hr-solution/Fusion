using System.Security.Cryptography;
using System.Text;
using EY.HRPlatform.Identity.Features.Eligibility;
using EY.HRPlatform.SharedKernel.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Memory;

namespace EY.HRPlatform.Identity.Tests.Features.Eligibility;

public sealed class InternalServiceRequestAuthorizerTests
{
    [Fact]
    public async Task AuthorizeAsync_AcceptsValidSignedRequestOnlyOnce()
    {
        var request = new DefaultHttpContext().Request;
        request.Method = HttpMethods.Post;
        request.Path = "/internal/identity/eligibility/evaluate";
        request.Body = new MemoryStream(Encoding.UTF8.GetBytes("{}"));
        request.ContentLength = request.Body.Length;
        AddSignedHeaders(request, "corehr", "2026-rotation-a", "test-secret", "nonce-1");

        using var cache = new MemoryCache(new MemoryCacheOptions());
        var authorizer = new InternalServiceRequestAuthorizer(cache, new InternalServiceAuthenticationOptions
        {
            Keys = new Dictionary<string, string> { ["2026-rotation-a"] = "test-secret" },
            AllowedCallers = ["corehr"],
        });

        Assert.True(await authorizer.AuthorizeAsync(request));
        Assert.False(await authorizer.AuthorizeAsync(request));
    }

    private static void AddSignedHeaders(HttpRequest request, string caller, string keyId, string secret, string nonce)
    {
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
        var bodyHash = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes("{}")));
        var payload = string.Join("\n", caller, keyId, timestamp, nonce, request.Method, request.Path, bodyHash);
        var signature = Convert.ToHexStringLower(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(payload)));
        request.Headers[InternalServiceRequestAuthorizer.CallerHeader] = caller;
        request.Headers[InternalServiceRequestAuthorizer.KeyIdHeader] = keyId;
        request.Headers[InternalServiceRequestAuthorizer.TimestampHeader] = timestamp;
        request.Headers[InternalServiceRequestAuthorizer.NonceHeader] = nonce;
        request.Headers[InternalServiceRequestAuthorizer.SignatureHeader] = signature;
    }
}
