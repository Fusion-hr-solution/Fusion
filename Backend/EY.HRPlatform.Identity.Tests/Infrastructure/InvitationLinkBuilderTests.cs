using EY.HRPlatform.Identity.Infrastructure.Services;
using Microsoft.Extensions.Configuration;

namespace EY.HRPlatform.Identity.Tests.Infrastructure;

public class InvitationLinkBuilderTests
{
    [Fact]
    public void Build_UsesConfiguredPublicBaseUrl()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Application:PublicBaseUrl"] = "https://demo.example.com/"
            })
            .Build();

        var link = InvitationLinkBuilder.Build(configuration, "abc123");

        Assert.Equal("https://demo.example.com/invite/accept?token=abc123", link);
    }

    [Fact]
    public void Build_UsesDefaultLocalBaseUrlWhenMissing()
    {
        var configuration = new ConfigurationBuilder().Build();

        var link = InvitationLinkBuilder.Build(configuration, "abc123");

        Assert.Equal("http://localhost:3000/invite/accept?token=abc123", link);
    }

    [Fact]
    public void Build_EncodesTokenForQueryString()
    {
        var link = InvitationLinkBuilder.Build("http://localhost:3000", "a+b/c?=");

        Assert.Equal("http://localhost:3000/invite/accept?token=a%2Bb%2Fc%3F%3D", link);
    }
}
