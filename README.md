# skill-model-router

Pi extension that automatically switches to a configured model when a skill is invoked, then restores the original model when the turn ends.

Route cheap skills to local models and expensive skills to cloud providers — no manual model switching needed.

![demo](assets/demo.gif)

## Install

```bash
pi install git:github.com/jparrill/skill-model-router
```

## Configure

On first run, the extension auto-creates a placeholder config with example entries:

![skill-router first run](https://raw.githubusercontent.com/jparrill/skill-model-router/main/assets/first-run.png)

Edit `~/.pi/agent/skill-models.json` to map skill names to providers or specific models:

```jsonc
{
  // "<skill-name>": "<provider>"              — first model from that provider
  // "<skill-name>": "<provider>/<model-id>"   — specific model

  "worklog-add": "local-moe",
  "worklog-report": "local-moe",
  "code-review": "anthropic-vertex/claude-sonnet-4-6",
  "deep-review": "anthropic-vertex/claude-opus-4-6"
}
```

| Format | Example | Behavior |
|--------|---------|----------|
| `"provider"` | `"local-moe"` | Uses the first model from that provider |
| `"provider/model-id"` | `"anthropic-vertex/claude-sonnet-4-6"` | Uses a specific model |

A sample config is included in `skill-models.example.json`.

## How it works

1. On `session_start`, loads `skill-models.json` from the Pi agent directory
2. On `input`, detects `/skill:<name>` invocations and checks the config
3. If a mapping exists, saves the current model, switches to the target
4. On `turn_end`, restores the original model

The status bar shows the current routing state:

- `router:4 skills` — loaded, idle
- `→ anthropic-vertex/claude-sonnet-4-6` — actively routed to a different model

## Requirements

- [Pi](https://github.com/earendil-works/pi) v0.80.7+
- At least two providers configured in `~/.pi/agent/models.json`

## License

MIT
