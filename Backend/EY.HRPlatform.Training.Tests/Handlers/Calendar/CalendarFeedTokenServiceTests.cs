using EY.HRPlatform.Training.Features.Calendar.Feed;

namespace EY.HRPlatform.Training.Tests.Handlers.Calendar;

public class CalendarFeedTokenServiceTests
{
    [Fact]
    public void Issue_ReturnsUrlSafeToken_AndDeterministicHash()
    {
        var svc = new CalendarFeedTokenService();
        var (token, hash) = svc.Issue();

        Assert.False(string.IsNullOrWhiteSpace(token));
        Assert.DoesNotContain('+', token);   // base64url, not standard base64
        Assert.DoesNotContain('/', token);
        Assert.DoesNotContain('=', token);
        Assert.Equal(hash, svc.Hash(token));  // hashing is deterministic
    }

    [Fact]
    public void Issue_ProducesDistinctTokensAndHashes()
    {
        var svc = new CalendarFeedTokenService();
        var a = svc.Issue();
        var b = svc.Issue();
        Assert.NotEqual(a.Token, b.Token);
        Assert.NotEqual(a.Hash, b.Hash);
    }

    [Fact]
    public void Hash_DiffersForDifferentTokens()
    {
        var svc = new CalendarFeedTokenService();
        Assert.NotEqual(svc.Hash("abc"), svc.Hash("abd"));
    }
}
