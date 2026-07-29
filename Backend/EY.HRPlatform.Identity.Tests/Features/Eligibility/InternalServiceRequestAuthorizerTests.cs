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

    [Fact]
    public async Task Signer_ProducesHeadersAcceptedByTheInboundAuthorizer()
    {
        var options = new InternalServiceAuthenticationOptions
        {
            CallerName = "module",
            ActiveKeyId = "2026-rotation-a",
            Keys = new Dictionary<string, string> { ["2026-rotation-a"] = "test-secret" },
            AllowedCallers = ["module"],
        };
        var signer = new InternalServiceRequestSigner(options);
        using var outbound = new HttpRequestMessage(HttpMethod.Post, "https://identity.local/internal/identity/eligibility/evaluate")
        {
            Content = new StringContent("{}", Encoding.UTF8, "application/json"),
        };

        await signer.SignAsync(outbound);

        var inbound = new DefaultHttpContext().Request;
        inbound.Method = HttpMethods.Post;
        inbound.Path = "/internal/identity/eligibility/evaluate";
        inbound.Body = new MemoryStream(Encoding.UTF8.GetBytes("{}"));
        foreach (var header in outbound.Headers)
            inbound.Headers[header.Key] = header.Value.ToArray();

        using var cache = new MemoryCache(new MemoryCacheOptions());
        var authorizer = new InternalServiceRequestAuthorizer(cache, options);
        Assert.True(await authorizer.AuthorizeAsync(inbound));
    }

    // -----------------------------------------------------------------------
    // Negative-path tests — each rejection branch fires independently
    // -----------------------------------------------------------------------

    [Fact]
    public async Task AuthorizeAsync_RejectsExpiredTimestamp()
    {
        // MaximumRequestAgeSeconds defaults to 300; sign with timestamp 360 s in the past.
        var request = new DefaultHttpContext().Request;
        request.Method = HttpMethods.Post;
        request.Path = "/internal/identity/eligibility/evaluate";
        request.Body = new MemoryStream(Encoding.UTF8.GetBytes("{}"));
        request.ContentLength = request.Body.Length;

        const string keyId = "2026-rotation-a";
        const string secret = "test-secret";
        const string caller = "corehr";
        var expiredTimestamp = DateTimeOffset.UtcNow.AddSeconds(-360).ToUnixTimeSeconds().ToString();
        var nonce = Guid.NewGuid().ToString("N");
        var bodyHash = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes("{}")));
        var payload = string.Join("\n", caller, keyId, expiredTimestamp, nonce, request.Method, request.Path, bodyHash);
        var signature = Convert.ToHexStringLower(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(payload)));

        request.Headers[InternalServiceRequestAuthorizer.CallerHeader] = caller;
        request.Headers[InternalServiceRequestAuthorizer.KeyIdHeader] = keyId;
        request.Headers[InternalServiceRequestAuthorizer.TimestampHeader] = expiredTimestamp;
        request.Headers[InternalServiceRequestAuthorizer.NonceHeader] = nonce;
        request.Headers[InternalServiceRequestAuthorizer.SignatureHeader] = signature;

        using var cache = new MemoryCache(new MemoryCacheOptions());
        var authorizer = new InternalServiceRequestAuthorizer(cache, new InternalServiceAuthenticationOptions
        {
            Keys = new Dictionary<string, string> { [keyId] = secret },
            AllowedCallers = [caller],
        });

        Assert.False(await authorizer.AuthorizeAsync(request));
    }

    [Fact]
    public async Task AuthorizeAsync_RejectsTamperedBody()
    {
        // Sign headers over "{}" but set the request body to different content.
        const string keyId = "2026-rotation-a";
        const string secret = "test-secret";
        const string caller = "corehr";
        const string path = "/internal/identity/eligibility/evaluate";
        const string signedBody = "{}";
        const string actualBody = "{\"tampered\":true}";

        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
        var nonce = Guid.NewGuid().ToString("N");
        // Sign over the ORIGINAL body — not the tampered one.
        var bodyHash = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(signedBody)));
        var payload = string.Join("\n", caller, keyId, timestamp, nonce, HttpMethods.Post, path, bodyHash);
        var signature = Convert.ToHexStringLower(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(payload)));

        var request = new DefaultHttpContext().Request;
        request.Method = HttpMethods.Post;
        request.Path = path;
        // Body contains the TAMPERED content.
        request.Body = new MemoryStream(Encoding.UTF8.GetBytes(actualBody));
        request.ContentLength = Encoding.UTF8.GetByteCount(actualBody);

        request.Headers[InternalServiceRequestAuthorizer.CallerHeader] = caller;
        request.Headers[InternalServiceRequestAuthorizer.KeyIdHeader] = keyId;
        request.Headers[InternalServiceRequestAuthorizer.TimestampHeader] = timestamp;
        request.Headers[InternalServiceRequestAuthorizer.NonceHeader] = nonce;
        request.Headers[InternalServiceRequestAuthorizer.SignatureHeader] = signature;

        using var cache = new MemoryCache(new MemoryCacheOptions());
        var authorizer = new InternalServiceRequestAuthorizer(cache, new InternalServiceAuthenticationOptions
        {
            Keys = new Dictionary<string, string> { [keyId] = secret },
            AllowedCallers = [caller],
        });

        Assert.False(await authorizer.AuthorizeAsync(request));
    }

    [Fact]
    public async Task AuthorizeAsync_RejectsDisallowedCaller()
    {
        // Options have AllowedCallers = ["module"] but the request claims "corehr".
        var request = new DefaultHttpContext().Request;
        request.Method = HttpMethods.Post;
        request.Path = "/internal/identity/eligibility/evaluate";
        request.Body = new MemoryStream(Encoding.UTF8.GetBytes("{}"));
        request.ContentLength = request.Body.Length;

        // Sign as "corehr" with a valid key.
        AddSignedHeaders(request, "corehr", "2026-rotation-a", "test-secret", Guid.NewGuid().ToString("N"));

        using var cache = new MemoryCache(new MemoryCacheOptions());
        var authorizer = new InternalServiceRequestAuthorizer(cache, new InternalServiceAuthenticationOptions
        {
            Keys = new Dictionary<string, string> { ["2026-rotation-a"] = "test-secret" },
            // "corehr" is NOT in the allowed list.
            AllowedCallers = ["module"],
        });

        Assert.False(await authorizer.AuthorizeAsync(request));
    }

    [Fact]
    public async Task AuthorizeAsync_RejectsUnknownKeyId()
    {
        // Sign with keyId "unknown-key" that is absent from the configured Keys dictionary.
        var request = new DefaultHttpContext().Request;
        request.Method = HttpMethods.Post;
        request.Path = "/internal/identity/eligibility/evaluate";
        request.Body = new MemoryStream(Encoding.UTF8.GetBytes("{}"));
        request.ContentLength = request.Body.Length;

        AddSignedHeaders(request, "corehr", "unknown-key", "any-secret", Guid.NewGuid().ToString("N"));

        using var cache = new MemoryCache(new MemoryCacheOptions());
        var authorizer = new InternalServiceRequestAuthorizer(cache, new InternalServiceAuthenticationOptions
        {
            // Only "2026-rotation-a" is configured; "unknown-key" is absent.
            Keys = new Dictionary<string, string> { ["2026-rotation-a"] = "test-secret" },
            AllowedCallers = ["corehr"],
        });

        Assert.False(await authorizer.AuthorizeAsync(request));
    }

    // -----------------------------------------------------------------------
    // Shared helper — builds a validly signed request with the current timestamp
    // -----------------------------------------------------------------------

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
