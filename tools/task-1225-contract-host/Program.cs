using System.Collections.Concurrent;
using System.Text;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;
using PidLitacka.Application.Features.TicketPayment.DTOs;
using PidLitacka.Application.Interfaces;
using PidLitacka.Application.Tests.Integration;
using PidLitacka.Domain.Entities.TicketPurchase;
using PidLitacka.Domain.Interfaces;
using TicketService.Client.Api;
using TicketService.Client.Common;
using TicketService.Client.Request;
using TicketService.Client.Response;

Directory.SetCurrentDirectory(AppContext.BaseDirectory);

if (!typeof(TicketWalletPaymentResponse).GetProperty("Status")!.PropertyType.IsEnum)
    throw new InvalidOperationException("Select the PID BE checkout implementing #1225; wallet Status must be an enum.");

var rawStatuses = new string?[] { "CREATED", "IN_PROGRESS", "PAID", "CANCELED_BY_USER",
    "CANCELED_BY_GATEWAY", "IN_REFUND_PROCESS", "REFUNDED", "FUTURE_STATE", "", null };
var paymentCases = rawStatuses.Select((status, index) => new FixtureCase(index + 1, status)).ToArray();
var bookingCases = new[] { "PREBOOKED", "CONFIRMED", "FULFILLED", "CANCELLED" }
    .Select((status, index) => Booking(Id(2, index + 1), status, null)).ToArray();
var bookings = paymentCases.Select(c => c.Booking).Concat(bookingCases).ToDictionary(b => b.BookingId);
var payments = new Mock<IPaymentsApi>(MockBehavior.Strict);
foreach (var item in paymentCases)
{
    var card = new PaymentResponse(item.PaymentId, "https://gateway.example/fixture-only", item.RawStatus!, item.Booking);
    var wallet = new WalletPaymentResponse(item.PaymentId, item.RawStatus?.ToLowerInvariant()!,
        item.RawStatus == "IN_PROGRESS", false, false, null, item.Booking);
    payments.Setup(p => p.GetPaymentAsync(item.Booking.BookingId, item.PaymentId, It.IsAny<CancellationToken>())).ReturnsAsync(card);
    payments.Setup(p => p.CreatePaymentAsync(item.Booking.BookingId, It.IsAny<string>(), It.IsAny<CreatePaymentRequest>(), It.IsAny<CancellationToken>())).ReturnsAsync(card);
    payments.Setup(p => p.ProcessWalletPaymentAsync(item.Booking.BookingId, item.PaymentId, It.IsAny<WalletProcessRequest>(), It.IsAny<CancellationToken>())).ReturnsAsync(wallet);
    payments.Setup(p => p.CreateApplePayPaymentAsync(item.Booking.BookingId, It.IsAny<string>(), It.IsAny<WalletPaymentRequest>(), It.IsAny<CancellationToken>())).ReturnsAsync(wallet);
    payments.Setup(p => p.CreateGooglePayPaymentAsync(item.Booking.BookingId, It.IsAny<string>(), It.IsAny<WalletPaymentRequest>(), It.IsAny<CancellationToken>())).ReturnsAsync(wallet);
    payments.Setup(p => p.CreateSavedCardPaymentAsync(item.Booking.BookingId, It.IsAny<string>(), It.IsAny<SavedCardPaymentRequest>(), It.IsAny<CancellationToken>())).ReturnsAsync(wallet);
}
var bookingsApi = new Mock<IBookingsApi>(MockBehavior.Strict);
foreach (var booking in bookings.Values)
    bookingsApi.Setup(b => b.GetBookingAsync(booking.BookingId, It.IsAny<CancellationToken>())).ReturnsAsync(booking);
foreach (var booking in bookingCases)
    bookingsApi.Setup(b => b.CreateBookingAsync(It.IsAny<string>(),
        It.Is<CreateBookingRequest>(r => r.OfferId == booking.Status), It.IsAny<CancellationToken>())).ReturnsAsync(booking);
bookingsApi.Setup(b => b.SearchBookingsAsync(It.IsAny<SearchBookingsRequest>(), It.IsAny<CancellationToken>()))
    .ReturnsAsync(new PagedResult<BookingResponse>(bookings.Values.ToArray(), bookings.Count, 20, 0));

var reservations = new ConcurrentDictionary<(Guid, Guid), TicketThreeDsReturnContext>();
var returns = new Mock<ITicketThreeDsReturnRepository>(MockBehavior.Strict);
returns.Setup(r => r.TryReserveAsync(It.IsAny<TicketThreeDsReturnContext>(), It.IsAny<CancellationToken>()))
    .ReturnsAsync((TicketThreeDsReturnContext c, CancellationToken _) => reservations.TryAdd((c.IdentityId, c.IdempotencyKey), c));
returns.Setup(r => r.FindAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
    .ReturnsAsync((Guid identity, Guid key, CancellationToken _) => reservations.GetValueOrDefault((identity, key)));
returns.Setup(r => r.BindPaymentAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
    .Callback((Guid id, Guid paymentId, CancellationToken _) => reservations.Values.Single(r => r.ReturnId == id).PaymentId = paymentId)
    .Returns(Task.CompletedTask);
var cards = new Mock<ITicketSavedCardTokenResolver>();
cards.Setup(c => c.ResolveAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
    .ReturnsAsync("synthetic-card-token");

await using var factory = new CustomWebApplicationFactory().WithWebHostBuilder(builder =>
    builder.ConfigureServices(services =>
    {
        services.RemoveAll<IPaymentsApi>(); services.AddSingleton(payments.Object);
        services.RemoveAll<IBookingsApi>(); services.AddSingleton(bookingsApi.Object);
        services.RemoveAll<ITicketThreeDsReturnRepository>(); services.AddSingleton(returns.Object);
        services.RemoveAll<ITicketSavedCardTokenResolver>(); services.AddSingleton(cards.Object);
        services.RemoveAll<ITicketPaymentReturnRepository>(); services.AddSingleton(Mock.Of<ITicketPaymentReturnRepository>());
        services.RemoveAll<ITicketPaymentSettingsService>(); services.AddSingleton(Mock.Of<ITicketPaymentSettingsService>());
        services.RemoveAll<ISavedPaymentCardService>(); services.AddSingleton(Mock.Of<ISavedPaymentCardService>());
        services.RemoveAll<ITicketPaymentSettlementScheduler>(); services.AddSingleton(Mock.Of<ITicketPaymentSettlementScheduler>());
    }));
using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
using var scope = factory.Services.CreateScope();
var identityId = Guid.Parse("12250000-aaaa-4000-8000-000000000001");
var (token, _) = scope.ServiceProvider.GetRequiredService<IJwtService>().GenerateAccessToken(identityId, "anonymous");

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://127.0.0.1:5125");
var app = builder.Build();
app.MapGet("/__test/session", () => Results.Json(new
{
    accessToken = token, fixture = "task-1225-contract", mode = "synthetic-tickets-responses",
    beAssembly = typeof(TicketWalletPaymentResponse).Assembly.Location
}));
app.MapMethods("/{**path}", ["GET", "POST"], async (HttpContext context) =>
{
    using var request = new HttpRequestMessage(new HttpMethod(context.Request.Method),
        context.Request.Path + context.Request.QueryString);
    foreach (var header in context.Request.Headers)
        if (!header.Key.Equals("Host", StringComparison.OrdinalIgnoreCase)
            && !header.Key.StartsWith("Content-", StringComparison.OrdinalIgnoreCase))
            request.Headers.TryAddWithoutValidation(header.Key, header.Value.ToArray());
    if (context.Request.ContentLength > 0)
    {
        using var reader = new StreamReader(context.Request.Body);
        request.Content = new StringContent(await reader.ReadToEndAsync(context.RequestAborted), Encoding.UTF8,
            context.Request.ContentType ?? "application/json");
    }
    using var response = await client.SendAsync(request, context.RequestAborted);
    context.Response.StatusCode = (int)response.StatusCode;
    foreach (var header in response.Headers)
        context.Response.Headers[header.Key] = header.Value.ToArray();
    context.Response.ContentType = response.Content.Headers.ContentType?.ToString() ?? "application/json";
    await response.Content.CopyToAsync(context.Response.Body, context.RequestAborted);
});
Console.WriteLine("TASK1225_HOST_READY http://127.0.0.1:5125; actual PID BE pipeline, synthetic Tickets responses");
await app.RunAsync();

static Guid Id(int group, int index) => Guid.Parse($"12250000-{group:0000}-4000-8000-{index:000000000000}");
static BookingResponse Booking(Guid id, string status, string? paymentState) => new(id,
    "12250000-aaaa-4000-8000-000000000001", null, status,
    new PriceDto(4800, "CZK", null), new PriceDto(4800, "CZK", null), paymentState,
    paymentState == "PAID" ? "2026-09-30T12:00:01Z" : null, [], [], "2026-09-30T12:00:00Z");

sealed class FixtureCase(int index, string? rawStatus)
{
    public string? RawStatus { get; } = rawStatus;
    public Guid PaymentId { get; } = Guid.Parse($"12250000-0001-4000-8000-{index:000000000000}");
    public BookingResponse Booking { get; } = new(Guid.Parse($"12250000-0000-4000-8000-{index:000000000000}"),
        "12250000-aaaa-4000-8000-000000000001", null, "CONFIRMED",
        new PriceDto(4800, "CZK", null), new PriceDto(4800, "CZK", null), rawStatus,
        rawStatus == "PAID" ? "2026-09-30T12:00:01Z" : null, [], [], "2026-09-30T12:00:00Z");
}
