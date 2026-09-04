using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using TicketService.Domain.Catalog.Entities;
using TicketService.Domain.Catalog.Enums;
using TicketService.Domain.Fulfillments.Entities;
using TicketService.Domain.Fulfillments.Enums;
using TicketService.Domain.ValueObjects;
using TicketService.Infrastructure.Persistence;

const string ConnectionVariable = "TICKETS_SMOKE_CONNECTION_STRING";
const string FixedVariant = "fixed";
const string ZonalVariant = "zonal";
const string MappedVariant = "mapped";
const string ProductSubTypeCode = "adult";

var userId = ReadArgument(args, "--user-id")?.Trim();
var variant = ReadArgument(args, "--variant")?.Trim().ToLowerInvariant() ?? FixedVariant;

if (string.IsNullOrWhiteSpace(userId) || userId.Length > 256)
{
    Console.Error.WriteLine("Usage: dotnet run -- --user-id <JWT subject> [--variant fixed|zonal|mapped]");
    return 2;
}

if (variant is not (FixedVariant or ZonalVariant or MappedVariant))
{
    Console.Error.WriteLine("Variant must be 'fixed', 'zonal', or 'mapped'.");
    return 2;
}

var connectionString = Environment.GetEnvironmentVariable(ConnectionVariable);
if (string.IsNullOrWhiteSpace(connectionString))
{
    Console.Error.WriteLine($"Environment variable {ConnectionVariable} is required.");
    return 2;
}

var connection = new NpgsqlConnectionStringBuilder(connectionString);
var isLocalHost = string.Equals(connection.Host, "localhost", StringComparison.OrdinalIgnoreCase)
                  || string.Equals(connection.Host, "127.0.0.1", StringComparison.OrdinalIgnoreCase);
if (!isLocalHost
    || connection.Port != 55432
    || !string.Equals(connection.Database, "ticket_service_dev", StringComparison.Ordinal))
{
    Console.Error.WriteLine(
        "Safety guard rejected the database. Expected localhost:55432/ticket_service_dev.");
    return 3;
}

var options = new DbContextOptionsBuilder<TicketServiceDbContext>()
    .UseNpgsql(connection.ConnectionString)
    .Options;

await using var db = new TicketServiceDbContext(options);
if (!await db.Database.CanConnectAsync())
{
    Console.Error.WriteLine("Cannot connect to the isolated Ticket Service smoke database.");
    return 4;
}

var productId = variant switch
{
    ZonalVariant => 960_002,
    MappedVariant => 1002,
    _ => 960_001
};
var productSubType = await db.ProductSubTypes.SingleOrDefaultAsync(x => x.Id == ProductSubTypeCode);
if (productSubType is null)
{
    productSubType = ProductSubType.Create(
        ProductSubTypeCode,
        new LocalizedString("Dospělý", "Adult", "Дорослий"),
        "adult",
        1);
    db.ProductSubTypes.Add(productSubType);
}

var product = await db.Products.SingleOrDefaultAsync(x => x.Id == productId);
if (product is null)
{
    product = CreateProduct(productId, variant);
    product.Publish();
    db.Products.Add(product);
}

if (product.ProductSubTypeCode != ProductSubTypeCode)
    product.AssignProductSubType(productSubType);

await db.SaveChangesAsync();

var validZones = variant == ZonalVariant ? null : new[] { "P", "0", "B" };
var fulfillment = Fulfillment.Issue(
    Guid.NewGuid(),
    Guid.NewGuid(),
    userId,
    productId,
    FulfillmentMediaType.DistributorApp,
    validZones);

db.Fulfillments.Add(fulfillment);
await db.SaveChangesAsync();

var persisted = await db.Fulfillments
    .AsNoTracking()
    .SingleAsync(x => x.Id == fulfillment.Id);

if (persisted.Status != FulfillmentStatus.Available || persisted.UserId != userId)
{
    Console.Error.WriteLine("Fixture verification failed after persistence.");
    return 5;
}

Console.WriteLine(JsonSerializer.Serialize(new
{
    fulfillmentId = persisted.Id,
    persisted.UserId,
    persisted.ProductId,
    productSubTypeCode = product.ProductSubTypeCode,
    status = persisted.Status.ToString().ToUpperInvariant(),
    variant,
    validZones = persisted.ValidZones
}));

return 0;

static string? ReadArgument(string[] arguments, string name)
{
    for (var i = 0; i < arguments.Length - 1; i++)
    {
        if (arguments[i].Equals(name, StringComparison.OrdinalIgnoreCase))
            return arguments[i + 1];
    }

    return null;
}

static Product CreateProduct(int productId, string variant)
{
    var today = DateOnly.FromDateTime(DateTime.UtcNow);
    var isZonal = variant == ZonalVariant;
    var isMapped = variant == MappedVariant;

    return Product.Create(
        new LocalizedString(
            isZonal
                ? "Smoke jízdenka – volba pásem"
                : isMapped ? "Mapovaná jízdenka – IPT 867" : "Smoke jízdenka – Praha 30 min",
            isZonal
                ? "Smoke ticket – zone selection"
                : isMapped ? "Mapped ticket – IPT 867" : "Smoke ticket – Prague 30 min"),
        ProductType.AdmissionSingle,
        isMapped ? 36m : 30m,
        12,
        30,
        ProductDurationType.FromActivation,
        ProductPricingType.Normal,
        isZonal ? null : ["P", "0", "B"],
        null,
        isZonal ? 3 : null,
        false,
        today.AddYears(-1),
        today.AddYears(1),
        [FulfillmentMediaType.DistributorApp.ToString()],
        null,
        false,
        null,
        productId);
}
