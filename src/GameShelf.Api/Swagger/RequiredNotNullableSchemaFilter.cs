using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace GameShelf.Api.Swagger;

/// <summary>
/// Marks every non-nullable property as required in the emitted schema.
///
/// By default Swashbuckle only lists properties carrying [Required], so an int or a
/// non-nullable string that the API always returns is still advertised as optional. Client
/// generators believe that document, and the frontend ends up defending against absent
/// fields the server never omits. The contract should say what is actually true.
/// </summary>
public class RequiredNotNullableSchemaFilter : ISchemaFilter
{
    public void Apply(OpenApiSchema schema, SchemaFilterContext context)
    {
        if (schema.Properties is null) return;

        foreach (var (name, property) in schema.Properties)
        {
            if (!property.Nullable) schema.Required.Add(name);
        }
    }
}
