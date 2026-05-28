# Brand Book — Local Setup

## Supabase MCP

The .mcp.json file is gitignored (contains PAT secret).
On a fresh machine, create it at /projects/brandbook/.mcp.json:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--access-token",
        "GET_FROM_GRANT",
        "--project-ref",
        "mxlbjqebyvayfxeioxph"
      ]
    }
  }
}
```

Get PAT from: https://supabase.com/dashboard/account/tokens

## TypeScript Types

Regenerate types after schema changes:

```bash
npx supabase gen types typescript \
  --project-id mxlbjqebyvayfxeioxph \
  --schema public \
  > lib/database.types.ts
```

## Supabase CLI Login

```bash
npx supabase login --token YOUR_PAT
```
