using EY.HRPlatform.SharedKernel.Security;
using Microsoft.Extensions.Configuration;

namespace EY.HRPlatform.Identity.Tests.Features.TenantAdministration;

/// <summary>
/// The boundary that makes immediate enforcement meaningful.
/// <para>
/// The Gateway re-checks tenant authority on every authenticated request. That is
/// only worth something if the Gateway is the only way in, so a module service
/// reachable directly is a hole in the whole mechanism rather than a deployment
/// detail.
/// </para>
/// </summary>
public sealed class GatewayOnlyBindingGuardTests
{
    [Theory]
    [InlineData("http://localhost:5301")]
    [InlineData("https://localhost:5300;http://localhost:5301")]
    [InlineData("http://127.0.0.1:5301")]
    [InlineData("http://[::1]:5301")]
    public void A_loopback_binding_starts(string urls)
    {
        var exception = Record.Exception(() =>
            GatewayOnlyBindingGuard.Verify("Core HR", urls, Configuration()));

        Assert.Null(exception);
    }

    [Theory]
    [InlineData("http://0.0.0.0:5301")]
    [InlineData("http://*:5301")]
    [InlineData("http://+:5301")]
    [InlineData("http://10.0.0.4:5301")]
    [InlineData("http://localhost:5300;http://0.0.0.0:5301")]
    public void An_externally_reachable_binding_refuses_to_start(string urls)
    {
        var failure = Assert.Throws<InvalidOperationException>(() =>
            GatewayOnlyBindingGuard.Verify("Core HR", urls, Configuration()));

        // The message has to explain the consequence, because the person reading
        // it at 2am is deciding whether to set the override.
        Assert.Contains("Gateway", failure.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void An_operator_can_take_the_decision_deliberately()
    {
        // Terminating ingress elsewhere is legitimate. What is not legitimate is
        // doing it by accident, so it takes an explicit setting.
        var exception = Record.Exception(() => GatewayOnlyBindingGuard.Verify(
            "Core HR",
            "http://0.0.0.0:5301",
            Configuration((GatewayOnlyBindingGuard.AllowNonLoopbackKey, "true"))));

        Assert.Null(exception);
    }

    [Fact]
    public void An_unconfigured_binding_is_not_treated_as_external()
    {
        // No configured URL means the host default applies. Failing here would
        // block every developer run without evidence of a real exposure.
        Assert.Null(Record.Exception(() =>
            GatewayOnlyBindingGuard.Verify("Core HR", null, Configuration())));
    }

    private static IConfiguration Configuration(params (string Key, string Value)[] values)
        => new ConfigurationBuilder()
            .AddInMemoryCollection(values.Select(item =>
                new KeyValuePair<string, string?>(item.Key, item.Value)))
            .Build();
}
