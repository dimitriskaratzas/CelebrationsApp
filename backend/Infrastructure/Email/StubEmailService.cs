using Application.Common.Interfaces;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Email;

// Phase 1 stub. Logs reset links to the console so manual testing works.
// Real provider (Brevo/SendGrid/etc.) is added in Phase 1.1 — swap-in only,
// no other code changes since callers depend on IEmailService.
public class StubEmailService(ILogger<StubEmailService> logger) : IEmailService
{
    public Task SendPasswordResetAsync(string toEmail, string resetLink, CancellationToken ct = default)
    {
        logger.LogWarning(
            "[STUB EMAIL] Password reset link for {ToEmail}: {ResetLink}",
            toEmail, resetLink);
        return Task.CompletedTask;
    }
}
